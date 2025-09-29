import type { TEPCODailyUsageResponse } from '../types/tepco'
import type { ElectricDailyUsage } from '../types/database'
import { logger } from '../utils/logger'

export class FeeCollector {
  private contractNum = '4021043250'
  private accountId = '1060717502'
  private contractClass = '02'

  async collectDailyUsage(token: string, date: string): Promise<ElectricDailyUsage | null> {
    try {
      const url = `https://kcx-api.tepco-z.com/kcx/billing/day?contractNum=${this.contractNum}&usedDay=${date}&contractClass=${this.contractClass}&readOffset=0&accountId=${this.accountId}`
      
      const trackingId = crypto.randomUUID()
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-API-Request-Id': trackingId,
          'x-kcx-tracking-id': trackingId,
          'Referer': 'https://www.app.kurashi.tepco.co.jp/',
          'Accept': 'application/json; charset=utf-8',
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'
        }
      })

      if (!response.ok) {
        logger.error(`API request failed: ${response.status} ${response.statusText}`)
        return null
      }

      const data: TEPCODailyUsageResponse = await response.json()
      return this.transformApiResponse(data)
    } catch (error) {
      logger.error('Error collecting daily usage:', error)
      return null
    }
  }

  async transformApiResponse(apiResponse: TEPCODailyUsageResponse): Promise<ElectricDailyUsage> {
    const usedInfo = apiResponse.billInfo.usedInfo
    const date = apiResponse.billInfo.usedDay
    
    return {
      usageDate: date,
      kwhUsed: Number(usedInfo.power),
      chargeYen: Number(usedInfo.charge),
      cumulativeKwh: Number(usedInfo.currentTotalInfo.power),
      cumulativeChargeYen: Number(usedInfo.currentTotalInfo.charge),
      billingStatus: apiResponse.billInfo.billingStatus,
      rateCategory: apiResponse.billInfo.electricRateCategory,
      lastUpdated: new Date(),
      collectedAt: new Date(),
      rawData: JSON.stringify(apiResponse),
    }
  }
}


