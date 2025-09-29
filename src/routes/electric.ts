import { Hono } from 'hono'
import * as models from '../database/models'
import { FeeCollector } from '../collectors/feeCollector'
import { BrowserAuth } from '../auth/browserAuth'
import { TokenManager } from '../auth/tokenManager'
import { logger } from '../utils/logger'

const electric = new Hono()
const feeCollector = new FeeCollector()
const tokenManager = new TokenManager()

// Raw daily usage data
electric.get('/daily/:date', async (c) => {
  const date = c.req.param('date') // YYYYMMDD
  const data = await models.getDailyUsage(date)
  if (!data) {
    return c.json({ error: 'Data not found' }, 404)
  }
  return c.json(data)
})

electric.get('/daily/range/:from/:to', async (c) => {
  const from = c.req.param('from')
  const to = c.req.param('to')
  const data = await models.getDailyUsageRange(from, to)
  return c.json(data)
})

// Aggregated endpoints
electric.get('/monthly/:yearMonth', async (c) => {
  const yearMonth = c.req.param('yearMonth') // YYYYMM
  const data = await models.getMonthlyAggregate(yearMonth)
  return c.json(data)
})

// Collection management
electric.post('/collect/yesterday', async (c) => {
  try {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const dateStr = yesterday.getFullYear().toString() +
      (yesterday.getMonth() + 1).toString().padStart(2, '0') +
      yesterday.getDate().toString().padStart(2, '0')
    
    // Get or refresh token
    let token = await tokenManager.getValidToken()
    if (!token) {
      // Need to authenticate
      const browserAuth = new BrowserAuth()
      await browserAuth.initBrowser()
      
      const username = process.env.TEPCO_USERNAME
      const password = process.env.TEPCO_PASSWORD
      
      if (!username || !password) {
        return c.json({ error: 'TEPCO credentials not configured' }, 500)
      }
      
      token = await browserAuth.login(username, password)
      
      // Store token with 24 hour expiry
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + 24)
      await tokenManager.storeToken(token, expiresAt)
      
      await browserAuth.closeBrowser()
    }
    
    // Collect yesterday's finalized data
    const data = await feeCollector.collectDailyUsage(token, dateStr)
    if (!data) {
      return c.json({ error: 'Failed to collect yesterday\'s data' }, 500)
    }
    
    // Upsert to database
    await models.upsertDailyUsage(data)
    
    return c.json({ 
      success: true, 
      date: dateStr,
      data: data 
    })
  } catch (error) {
    logger.error('Error collecting yesterday\'s data:', error)
    return c.json({ error: 'Collection failed' }, 500)
  }
})

electric.post('/collect/backfill', async (c) => {
  try {
    const { startDate, endDate } = await c.req.json()
    
    if (!startDate || !endDate) {
      return c.json({ error: 'startDate and endDate required' }, 400)
    }
    
    // Get or refresh token (same logic as /collect/yesterday)
    let token = await tokenManager.getValidToken()
    if (!token) {
      const browserAuth = new BrowserAuth()
      await browserAuth.initBrowser()
      
      const username = process.env.TEPCO_USERNAME
      const password = process.env.TEPCO_PASSWORD
      
      if (!username || !password) {
        return c.json({ error: 'TEPCO credentials not configured' }, 500)
      }
      
      token = await browserAuth.login(username, password)
      
      // Store token with 24 hour expiry
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + 24)
      await tokenManager.storeToken(token, expiresAt)
      
      await browserAuth.closeBrowser()
    }
    
    const results = []
    const currentDate = new Date(startDate)
    const end = new Date(endDate)
    
    while (currentDate <= end) {
      const dateStr = currentDate.getFullYear().toString() +
        (currentDate.getMonth() + 1).toString().padStart(2, '0') +
        currentDate.getDate().toString().padStart(2, '0')
      
      const data = await feeCollector.collectDailyUsage(token, dateStr)
      if (data) {
        await models.upsertDailyUsage(data)
        results.push({ date: dateStr, success: true })
      } else {
        results.push({ date: dateStr, success: false })
      }
      
      currentDate.setDate(currentDate.getDate() + 1)
    }
    
    return c.json({ 
      success: true, 
      results 
    })
  } catch (error) {
    logger.error('Error during backfill:', error)
    return c.json({ error: 'Backfill failed' }, 500)
  }
})

export default electric
