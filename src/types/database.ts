export interface ElectricDailyUsage {
  id?: number
  usageDate: string
  kwhUsed: number
  chargeYen: number
  cumulativeKwh: number
  cumulativeChargeYen: number
  billingStatus: string
  rateCategory: string
  lastUpdated: Date
  collectedAt: Date
  rawData: string
}

export interface AuthSession {
  id?: number
  sessionData: string
  bearerToken: string
  contractInfo: string
  expiresAt: Date
  createdAt: Date
}

export interface CollectionLog {
  id?: number
  utilityType: 'electric' | 'gas' | 'water'
  collectionType: 'daily' | 'weekly' | 'backfill' | 'manual'
  status: 'success' | 'error' | 'partial'
  datesProcessed: string
  recordsCollected: number
  recordsUpdated: number
  executionTimeMs: number
  errorDetails?: string
  createdAt: Date
}


