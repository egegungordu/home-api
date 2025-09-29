import cron from 'node-cron'
import { logger } from '../utils/logger'
import { BrowserAuth } from '../auth/browserAuth'
import { TokenManager } from '../auth/tokenManager'
import { FeeCollector } from '../collectors/feeCollector'
import * as models from '../database/models'

export function registerJobs(): void {
  logger.info('Registering scheduled jobs...')
  
  // Collect yesterday's finalized data daily at 1:00 AM
  // This gives TEPCO time to finalize the previous day's data
  cron.schedule('0 1 * * *', async () => {
    logger.info('Running scheduled collection of yesterday\'s finalized data...')
    try {
      await collectYesterdaysData()
      logger.info('Yesterday\'s data collection completed successfully')
    } catch (error) {
      logger.error('Yesterday\'s data collection failed:', error)
    }
  })

  // Token refresh check every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    logger.info('Checking token validity...')
    try {
      await refreshTokenIfNeeded()
    } catch (error) {
      logger.error('Token refresh check failed:', error)
    }
  })

  // Weekly backfill check on Sundays at 2 AM
  // This checks for any missing dates in the last 30 days
  cron.schedule('0 2 * * 0', async () => {
    logger.info('Running weekly backfill check...')
    try {
      await weeklyBackfillCheck()
      logger.info('Weekly backfill check completed successfully')
    } catch (error) {
      logger.error('Weekly backfill check failed:', error)
    }
  })

  // Cleanup old logs monthly on the 1st at 3 AM
  cron.schedule('0 3 1 * *', async () => {
    logger.info('Running monthly cleanup...')
    try {
      await cleanupOldLogs()
      logger.info('Monthly cleanup completed successfully')
    } catch (error) {
      logger.error('Monthly cleanup failed:', error)
    }
  })
}

async function collectYesterdaysData(): Promise<void> {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const dateStr = yesterday.getFullYear().toString() +
    (yesterday.getMonth() + 1).toString().padStart(2, '0') +
    yesterday.getDate().toString().padStart(2, '0')
  
  const token = await getValidToken()
  if (!token) {
    throw new Error('No valid token available for collection')
  }
  
  const feeCollector = new FeeCollector()
  const data = await feeCollector.collectDailyUsage(token, dateStr)
  
  if (data) {
    await models.upsertDailyUsage(data)
    logger.info(`Yesterday's finalized data collected and stored: ${data.kwhUsed} kWh`)
  } else {
    throw new Error('Failed to collect yesterday\'s data')
  }
}

async function refreshTokenIfNeeded(): Promise<void> {
  const tokenManager = new TokenManager()
  const isExpired = await tokenManager.isTokenExpired()
  
  if (isExpired) {
    logger.info('Token expired, attempting to refresh...')
    await refreshToken()
  } else {
    logger.debug('Token still valid')
  }
}

async function weeklyBackfillCheck(): Promise<void> {
  const token = await getValidToken()
  if (!token) {
    logger.warn('No valid token available for weekly backfill')
    return
  }
  
  // Check last 30 days for any missing data
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 30)
  
  const fromDate = startDate.getFullYear().toString() +
    (startDate.getMonth() + 1).toString().padStart(2, '0') +
    startDate.getDate().toString().padStart(2, '0')
  
  const toDate = endDate.getFullYear().toString() +
    (endDate.getMonth() + 1).toString().padStart(2, '0') +
    endDate.getDate().toString().padStart(2, '0')
  
  const existingData = await models.getDailyUsageRange(fromDate, toDate)
  const existingDates = new Set(existingData.map(record => record.usageDate))
  
  // Find missing dates
  const missingDates: string[] = []
  const currentDate = new Date(startDate)
  
  while (currentDate <= endDate) {
    const dateStr = currentDate.getFullYear().toString() +
      (currentDate.getMonth() + 1).toString().padStart(2, '0') +
      currentDate.getDate().toString().padStart(2, '0')
    
    if (!existingDates.has(dateStr)) {
      missingDates.push(dateStr)
    }
    
    currentDate.setDate(currentDate.getDate() + 1)
  }
  
  if (missingDates.length > 0) {
    logger.info(`Found ${missingDates.length} missing dates, attempting backfill...`)
    await backfillDates(token, missingDates)
  } else {
    logger.info('No missing dates found, backfill not needed')
  }
}

async function backfillDates(token: string, dates: string[]): Promise<void> {
  const feeCollector = new FeeCollector()
  
  for (const date of dates) {
    try {
      const data = await feeCollector.collectDailyUsage(token, date)
      if (data) {
        await models.upsertDailyUsage(data)
        logger.info(`Backfilled data for ${date}: ${data.kwhUsed} kWh`)
      }
    } catch (error) {
      logger.error(`Failed to backfill data for ${date}:`, error)
    }
  }
}

async function cleanupOldLogs(): Promise<void> {
  // Keep logs for 90 days
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - 90)
  
  // This would require adding a cleanup function to the database models
  // For now, just log that cleanup would happen
  logger.info('Monthly cleanup: would remove logs older than 90 days')
}

async function getValidToken(): Promise<string> {
  const tokenManager = new TokenManager()
  let token = await tokenManager.getValidToken()
  
  if (!token) {
    logger.info('No valid token found, attempting to authenticate...')
    token = await refreshToken()
  }
  
  return token
}

async function refreshToken(): Promise<string> {
  const browserAuth = new BrowserAuth()
  await browserAuth.initBrowser()
  
  const username = process.env.TEPCO_USERNAME
  const password = process.env.TEPCO_PASSWORD
  
  if (!username || !password) {
    throw new Error('TEPCO credentials not configured')
  }
  
  const token = await browserAuth.login(username, password)
  
  // Store token with 24 hour expiry
  const tokenManager = new TokenManager()
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + 24)
  await tokenManager.storeToken(token, expiresAt)
  
  await browserAuth.closeBrowser()
  
  logger.info('Token refreshed successfully')
  return token
}


