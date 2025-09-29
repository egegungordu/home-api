export interface TEPCODailyUsageResponse {
  commonInfo: {
    timestamp: string
  }
  billInfo: {
    usedDay: string
    billingStatus: string
    electricRateCategory: string
    timezonePrice: string
    usedInfo: {
      charge: string
      power: string
      unit: string
      beforeTotalInfo: {
        charge: string
        power: string
        unit: string
      }
      currentTotalInfo: {
        charge: string
        power: string
        unit: string
      }
    }
  }
}

export interface TEPCOContract {
  contractNum: string
  accountId: string
  contractClass: string
}


