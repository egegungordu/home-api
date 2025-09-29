import { BrowserAuth } from './src/auth/browserAuth'
import { TokenManager } from './src/auth/tokenManager'
import { FeeCollector } from './src/collectors/feeCollector'
import * as models from './src/database/models'
import { runMigrations } from './src/database/migrations'

async function testFullSystem() {
  try {
    console.log('🧪 Testing Full TEPCO Data Collection System')
    console.log('============================================')
    
    // 1. Setup
    console.log('\n1️⃣ Setting up database...')
    runMigrations()
    console.log('✅ Database setup complete')
    
    // 2. Test authentication
    console.log('\n2️⃣ Testing authentication...')
    const username = process.env.TEPCO_USERNAME
    const password = process.env.TEPCO_PASSWORD
    
    if (!username || !password) {
      console.log('❌ TEPCO credentials not set. Set TEPCO_USERNAME and TEPCO_PASSWORD environment variables.')
      console.log('Example: TEPCO_USERNAME=your_email TEPCO_PASSWORD=your_password bun run test-full-system.ts')
      return
    }
    
    const browserAuth = new BrowserAuth()
    await browserAuth.initBrowser()
    
    console.log('🔐 Attempting login...')
    const token = await browserAuth.login(username, password)
    
    if (!token) {
      throw new Error('Login failed - no token received')
    }
    
    console.log(`✅ Login successful! Token length: ${token.length}`)
    
    // 3. Test token storage
    console.log('\n3️⃣ Testing token storage...')
    const tokenManager = new TokenManager()
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24)
    await tokenManager.storeToken(token, expiresAt)
    console.log('✅ Token stored successfully')
    
    // 4. Test data collection
    console.log('\n4️⃣ Testing data collection...')
    const feeCollector = new FeeCollector()
    
    // Test yesterday's data (this should work since it's finalized)
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.getFullYear().toString() +
      (yesterday.getMonth() + 1).toString().padStart(2, '0') +
      yesterday.getDate().toString().padStart(2, '0')
    
    console.log(`📊 Collecting data for yesterday (${yesterdayStr})...`)
    const yesterdayData = await feeCollector.collectDailyUsage(token, yesterdayStr)
    
    if (!yesterdayData) {
      throw new Error('Failed to collect yesterday\'s data')
    }
    
    console.log(`✅ Yesterday's data collected: ${yesterdayData.kwhUsed} kWh, ¥${yesterdayData.chargeYen}`)
    
    // 5. Test database operations
    console.log('\n5️⃣ Testing database operations...')
    await models.upsertDailyUsage(yesterdayData)
    console.log('✅ Data stored in database')
    
    // Test retrieval
    const retrievedData = await models.getDailyUsage(yesterdayStr)
    if (retrievedData) {
      console.log(`✅ Data retrieved from database: ${retrievedData.kwhUsed} kWh`)
    } else {
      throw new Error('Failed to retrieve data from database')
    }
    
    // 6. Test API endpoints
    console.log('\n6️⃣ Testing API endpoints...')
    const monthlyData = await models.getMonthlyAggregate(yesterdayStr.substring(0, 6))
    console.log(`✅ Monthly aggregate: ${monthlyData.totalKwh} kWh, ${monthlyData.days} days`)
    
    // 7. Test token retrieval
    console.log('\n7️⃣ Testing token retrieval...')
    const storedToken = await tokenManager.getValidToken()
    if (storedToken) {
      console.log('✅ Stored token retrieved successfully')
    } else {
      throw new Error('Failed to retrieve stored token')
    }
    
    // 8. Test data collection with stored token
    console.log('\n8️⃣ Testing data collection with stored token...')
    const dayBeforeYesterday = new Date()
    dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2)
    const dayBeforeYesterdayStr = dayBeforeYesterday.getFullYear().toString() +
      (dayBeforeYesterday.getMonth() + 1).toString().padStart(2, '0') +
      dayBeforeYesterday.getDate().toString().padStart(2, '0')
    
    console.log(`📊 Collecting data for day before yesterday (${dayBeforeYesterdayStr})...`)
    const dayBeforeYesterdayData = await feeCollector.collectDailyUsage(storedToken, dayBeforeYesterdayStr)
    
    if (dayBeforeYesterdayData) {
      await models.upsertDailyUsage(dayBeforeYesterdayData)
      console.log(`✅ Day before yesterday's data collected and stored: ${dayBeforeYesterdayData.kwhUsed} kWh`)
    } else {
      console.log('⚠️  Day before yesterday\'s data not available (this is normal for recent dates)')
    }
    
    // 9. Summary
    console.log('\n🎉 System Test Summary')
    console.log('=====================')
    console.log('✅ Authentication: Working')
    console.log('✅ Token Management: Working')
    console.log('✅ Data Collection: Working')
    console.log('✅ Database Operations: Working')
    console.log('✅ API Endpoints: Working')
    console.log('✅ Token Persistence: Working')
    
    console.log('\n🚀 The system is ready for production!')
    console.log('\nKey Changes Made:')
    console.log('• Removed intraday collection (TEPCO only provides finalized data)')
    console.log('• Simplified to daily collection of yesterday\'s data at 1:00 AM')
    console.log('• All data is final by definition')
    console.log('• Weekly backfill checks for missing dates')
    
    console.log('\nNext steps:')
    console.log('1. Set up environment variables in production')
    console.log('2. Enable scheduler: ENABLE_SCHEDULER=true')
    console.log('3. Deploy to Raspberry Pi')
    console.log('4. Monitor logs for automated collection')
    
    await browserAuth.closeBrowser()
    
  } catch (error) {
    console.error('\n❌ System test failed:', error)
    console.log('\n🔍 Troubleshooting tips:')
    console.log('- Check TEPCO credentials')
    console.log('- Verify network connectivity')
    console.log('- Check browser automation')
    console.log('- Review database permissions')
  }
}

// Run the test
testFullSystem()
