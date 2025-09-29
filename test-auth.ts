import { BrowserAuth } from './src/auth/browserAuth'
import { TokenManager } from './src/auth/tokenManager'
import { FeeCollector } from './src/collectors/feeCollector'
import { runMigrations } from './src/database/migrations'

async function testAuth() {
  try {
    console.log('Running database migrations...')
    runMigrations()
    
    console.log('Testing browser authentication...')
    const browserAuth = new BrowserAuth()
    
    // Check if credentials are set
    const username = process.env.TEPCO_USERNAME
    const password = process.env.TEPCO_PASSWORD
    
    if (!username || !password) {
      console.log('TEPCO credentials not set. Set TEPCO_USERNAME and TEPCO_PASSWORD environment variables.')
      console.log('You can test the flow by running:')
      console.log('TEPCO_USERNAME=your_email TEPCO_PASSWORD=your_password bun run test-auth.ts')
      return
    }
    
    console.log('Initializing browser...')
    await browserAuth.initBrowser()
    
    console.log('Browser window should now be visible. Attempting login...')
    const token = await browserAuth.login(username, password)
    
    if (token) {
      console.log('Login successful! Token length:', token.length)
      
      // Test token storage
      const tokenManager = new TokenManager()
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + 24)
      await tokenManager.storeToken(token, expiresAt)
      
      console.log('Token stored successfully')
      
      // Test data collection
      const feeCollector = new FeeCollector()
      const today = new Date()
      const dateStr = today.getFullYear().toString() +
        (today.getMonth() + 1).toString().padStart(2, '0') +
        today.getDate().toString().padStart(2, '0')
      
      console.log('Collecting data for today:', dateStr)
      const data = await feeCollector.collectDailyUsage(token, dateStr)
      
      if (data) {
        console.log('Data collected successfully:', {
          date: data.usageDate,
          kwh: data.kwhUsed,
          charge: data.chargeYen,
          isFinal: data.isFinal
        })
      } else {
        console.log('Failed to collect data')
      }
    } else {
      console.log('Login failed - no token received')
    }
    
    console.log('Press Enter to close the browser...')
    await new Promise(resolve => {
      process.stdin.once('data', resolve)
    })
    
    await browserAuth.closeBrowser()
    
  } catch (error) {
    console.error('Test failed:', error)
    
    // Additional debugging for common issues
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    if (errorMessage.includes('ERR_HTTP2_PROTOCOL_ERROR')) {
      console.log('\nHTTP/2 Protocol Error detected. This is a common issue with TEPCO\'s site.')
      console.log('The updated browser configuration should handle this.')
      console.log('If the issue persists, try:')
      console.log('1. Check your network connection')
      console.log('2. Try from a different network (some corporate networks block certain sites)')
      console.log('3. Verify the TEPCO login URL is accessible in a regular browser')
    }
    
    if (errorMessage.includes('Login form not found')) {
      console.log('\nLogin form not found. This could mean:')
      console.log('1. TEPCO has changed their login page structure')
      console.log('2. The page is blocking automated access')
      console.log('3. There\'s a CAPTCHA or other security measure')
      console.log('Check login-page-error.png for a screenshot of what the browser sees.')
    }
    
    console.log('\nPress Enter to close the browser...')
    await new Promise(resolve => {
      process.stdin.once('data', resolve)
    })
  }
}

// Run the test
testAuth()
