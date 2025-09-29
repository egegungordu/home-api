import { chromium, type Browser, type Page } from 'playwright'
import { logger } from '../utils/logger'

export class BrowserAuth {
  private browser: Browser | null = null
  private page: Page | null = null
  private bearerToken: string | null = null

  async initBrowser(): Promise<Browser> {
    if (this.browser) {
      return this.browser
    }

    // Default to non-headless for reliability with TEPCO
    const isHeadless = process.env.BROWSER_HEADLESS === 'true'
    
    this.browser = await chromium.launch({
      headless: isHeadless,
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-http2', // Disable HTTP/2 to avoid protocol errors
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-extensions-except', // Disable extensions
        '--disable-plugins-discovery', // Disable plugin discovery
        '--no-first-run', // Skip first run setup
        '--no-default-browser-check', // Skip default browser check
        '--disable-default-apps', // Disable default apps
        '--disable-sync', // Disable sync
        '--metrics-recording-only', // Disable metrics
        '--disable-background-networking', // Disable background networking
        '--disable-background-downloads', // Disable background downloads
        '--disable-client-side-phishing-detection', // Disable phishing detection
        '--disable-component-update', // Disable component updates
        '--disable-domain-reliability', // Disable domain reliability
        '--disable-features=AudioServiceOutOfProcess', // Disable audio service
        '--disable-hang-monitor', // Disable hang monitor
        '--disable-prompt-on-repost', // Disable repost prompt
        '--disable-renderer-backgrounding', // Disable renderer backgrounding
        '--disable-sync-preferences', // Disable sync preferences
        '--disable-web-resources', // Disable web resources
        '--no-default-browser-check', // No default browser check
        '--no-pings', // No pings
        '--no-zygote', // No zygote
        '--single-process', // Single process
        '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'
      ],
    })

    this.page = await this.browser.newPage()
    
    // Set additional headers to mimic a real browser
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9,ja;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Ch-Ua': '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"macOS"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1'
    })
    
    // Hide automation indicators
    await this.page.addInitScript(() => {
      // Remove webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      })
      
      // Override permissions query to avoid detection
      const originalQuery = window.navigator.permissions.query
      window.navigator.permissions.query = (parameters: any) => {
        if (parameters.name === 'notifications') {
          return Promise.resolve({ 
            state: Notification.permission,
            name: parameters.name,
            onchange: null,
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => true
          } as any)
        }
        return originalQuery(parameters)
      }
      
      // Override plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      })
      
      // Override languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en', 'ja'],
      })
    })
    
    // Listen for network requests to capture the bearer token
    this.page.on('request', (request) => {
      const url = request.url()
      if (url.includes('kcx-api.tepco-z.com') && request.headers()['authorization']) {
        const authHeader = request.headers()['authorization']
        if (authHeader?.startsWith('Bearer ')) {
          this.bearerToken = authHeader.replace('Bearer ', '')
          logger.info('Bearer token captured from network request')
        }
      }
    })

    return this.browser
  }

  async login(username: string, password: string): Promise<string> {
    if (!this.page) {
      throw new Error('Browser not initialized')
    }

    logger.info('Navigating to TEPCO login page')
    
    // Try multiple navigation strategies
    const navigationStrategies = [
      // Strategy 1: Direct navigation
      async () => {
        await this.page!.goto('https://epauth.tepco.co.jp/u/login', {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        })
      },
      // Strategy 2: Via main site
      async () => {
        await this.page!.goto('https://www.tepco.co.jp', {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        })
        await this.page!.goto('https://epauth.tepco.co.jp/u/login', {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        })
      },
      // Strategy 3: With longer timeout and different wait strategy
      async () => {
        await this.page!.goto('https://epauth.tepco.co.jp/u/login', {
          waitUntil: 'load',
          timeout: 60000
        })
      }
    ]
    
    let navigationSuccess = false
    let lastError: Error | null = null
    
    for (const strategy of navigationStrategies) {
      try {
        await strategy()
        navigationSuccess = true
        logger.info('Navigation successful with current strategy')
        break
      } catch (error) {
        lastError = error as Error
        logger.warn('Navigation strategy failed:', error)
        continue
      }
    }
    
    if (!navigationSuccess) {
      logger.error('All navigation strategies failed')
      throw new Error(`Failed to navigate to TEPCO login: ${lastError?.message}`)
    }
    
    // Wait for the login form to load with more flexible selectors
    try {
      // First, let's see what's actually on the page
      logger.info('Page loaded, checking content...')
      
      // Wait a bit for any dynamic content to load
      await this.page.waitForTimeout(5000)
      
      // Get page title and URL for debugging
      const title = await this.page.title()
      const url = this.page.url()
      logger.info(`Page title: ${title}`)
      logger.info(`Current URL: ${url}`)
      
      // Check if we're on the right page
      if (url.includes('authorize') || url.includes('auth0')) {
        logger.info('Detected Auth0 flow, waiting for redirect...')
        // Wait longer for Auth0 redirects
        await this.page.waitForTimeout(5000)
      }
      
      // Try multiple selectors for the login form
      const selectors = [
        'input[type="email"]',
        'input[name="email"]', 
        'input[type="text"]',
        'input[placeholder*="email" i]',
        'input[placeholder*="メール" i]',
        'input[placeholder*="ログイン" i]',
        'input[id*="email" i]',
        'input[id*="login" i]'
      ]
      
      let formFound = false
      for (const selector of selectors) {
        try {
          const element = await this.page.waitForSelector(selector, { 
            timeout: 5000,
            state: 'visible'
          })
          if (element) {
            logger.info(`Found login form with selector: ${selector}`)
            formFound = true
            break
          }
        } catch (e) {
          logger.debug(`Selector ${selector} not found`)
        }
      }
      
      if (!formFound) {
        // Take a screenshot and get page content for debugging
        await this.page.screenshot({ path: 'login-page-debug.png' })
        const pageContent = await this.page.content()
        logger.error('Login form not found. Page content preview:', pageContent.substring(0, 1000))
        throw new Error('Login form not found on page after trying multiple selectors')
      }
      
    } catch (error) {
      logger.error('Login form not found:', error)
      // Take a screenshot for debugging
      await this.page.screenshot({ path: 'login-page-error.png' })
      throw new Error('Login form not found on page')
    }
    
    // Fill in credentials
    await this.page.fill('input[type="email"], input[name="email"], input[type="text"]', username)
    await this.page.fill('input[type="password"], input[name="password"]', password)
    
    // Submit the form
    await this.page.click('button[type="submit"], input[type="submit"], button:has-text("ログイン"), button:has-text("Login")')
    
    // Wait a bit more for any API calls to complete
    await this.page.waitForTimeout(10000)
    
    if (!this.bearerToken) {
      // Try to extract token from localStorage as fallback
      const token = await this.page.evaluate(() => {
        return localStorage.getItem('access_token') || 
               localStorage.getItem('bearer_token') ||
               sessionStorage.getItem('access_token') ||
               sessionStorage.getItem('bearer_token')
      })
      
      if (token) {
        this.bearerToken = token
        logger.info('Bearer token captured from localStorage/sessionStorage')
      } else {
        throw new Error('Failed to capture bearer token during login')
      }
    }
    
    logger.info('Login successful, bearer token captured')
    return this.bearerToken
  }

  async extractBearerToken(): Promise<string | null> {
    return this.bearerToken
  }

  async refreshSession(): Promise<boolean> {
    // For now, return false to trigger re-authentication
    // In a real implementation, we'd check if the current session is still valid
    return false
  }

  async closeBrowser(): Promise<void> {
    if (this.page) {
      await this.page.close()
      this.page = null
    }
    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
    this.bearerToken = null
  }

  async getCurrentToken(): Promise<string | null> {
    return this.bearerToken
  }
}


