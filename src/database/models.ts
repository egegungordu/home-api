import { db } from './db'
import type { ElectricDailyUsage } from '../types/database'
import { logger } from '../utils/logger'

type DbElectricDailyUsage = {
  id?: number
  usage_date: string
  kwh_used: number
  charge_yen: number
  cumulative_kwh: number
  cumulative_charge_yen: number
  billing_status: string | null
  rate_category: string | null
  last_updated: string
  collected_at: string
  raw_data: string
}

function mapDbRowToElectricDailyUsage(row: DbElectricDailyUsage): ElectricDailyUsage {
  return {
    id: row.id,
    usageDate: row.usage_date,
    kwhUsed: Number(row.kwh_used),
    chargeYen: Number(row.charge_yen),
    cumulativeKwh: Number(row.cumulative_kwh),
    cumulativeChargeYen: Number(row.cumulative_charge_yen),
    billingStatus: row.billing_status ?? '',
    rateCategory: row.rate_category ?? '',
    lastUpdated: new Date(row.last_updated),
    collectedAt: new Date(row.collected_at),
    rawData: row.raw_data
  }
}

export async function getDailyUsage(usageDate: string): Promise<ElectricDailyUsage | null> {
  const result = db
    .query<DbElectricDailyUsage, [string]>('SELECT * FROM daily_usage WHERE usage_date = ?')
    .get(usageDate)

  return result ? mapDbRowToElectricDailyUsage(result) : null
}

export async function insertDailyUsage(data: ElectricDailyUsage): Promise<void> {
  db.run(
    `INSERT INTO daily_usage (
      usage_date, kwh_used, charge_yen, cumulative_kwh, cumulative_charge_yen,
      billing_status, rate_category, last_updated, collected_at, raw_data
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.usageDate,
      data.kwhUsed,
      data.chargeYen,
      data.cumulativeKwh,
      data.cumulativeChargeYen,
      data.billingStatus,
      data.rateCategory,
      data.lastUpdated.toISOString(),
      data.collectedAt.toISOString(),
      data.rawData
    ]
  )
}

export async function updateDailyUsage(usageDate: string, data: ElectricDailyUsage): Promise<void> {
  db.run(
    `UPDATE daily_usage SET 
      kwh_used = ?, charge_yen = ?, cumulative_kwh = ?, cumulative_charge_yen = ?,
      billing_status = ?, rate_category = ?, last_updated = ?, 
      collected_at = ?, raw_data = ?
    WHERE usage_date = ?`,
    [
      data.kwhUsed,
      data.chargeYen,
      data.cumulativeKwh,
      data.cumulativeChargeYen,
      data.billingStatus,
      data.rateCategory,
      data.lastUpdated.toISOString(),
      data.collectedAt.toISOString(),
      data.rawData,
      usageDate
    ]
  )
}

export async function upsertDailyUsage(newData: ElectricDailyUsage): Promise<void> {
  const existing = await getDailyUsage(newData.usageDate)

  if (!existing) {
    // Insert new record
    await insertDailyUsage(newData)
    logger.info(`Inserted new record for ${newData.usageDate}`)
    return
  }

  // Since TEPCO only provides finalized data, we should always update if values changed
  // This handles cases where we might get corrected data for past dates
  if (hasValueChanged(existing, newData)) {
    await updateDailyUsage(newData.usageDate, {
      ...newData,
      lastUpdated: new Date(),
    })

    // Log the update
    logger.info(
      `Updated ${newData.usageDate}: ${existing.kwhUsed} -> ${newData.kwhUsed} kWh`
    )
  } else {
    logger.debug(`No changes for ${newData.usageDate}, skipping update`)
  }
}

function hasValueChanged(
  existing: ElectricDailyUsage,
  newData: ElectricDailyUsage
): boolean {
  return (
    existing.kwhUsed !== newData.kwhUsed ||
    existing.chargeYen !== newData.chargeYen ||
    existing.cumulativeKwh !== newData.cumulativeKwh ||
    existing.cumulativeChargeYen !== newData.cumulativeChargeYen
  )
}

export async function getDailyUsageRange(fromDate: string, toDate: string): Promise<ElectricDailyUsage[]> {
  const results = db
    .query<DbElectricDailyUsage, [string, string]>(
      'SELECT * FROM daily_usage WHERE usage_date BETWEEN ? AND ? ORDER BY usage_date'
    )
    .all(fromDate, toDate)

  return results.map(mapDbRowToElectricDailyUsage)
}

export async function getMonthlyAggregate(yearMonth: string): Promise<{
  totalKwh: number
  totalCharge: number
  days: number
  averageKwh: number
}> {
  const year = yearMonth.substring(0, 4)
  const month = yearMonth.substring(4, 6)
  const fromDate = `${year}${month}01`
  const toDate = `${year}${month}31`
  
  const results = await getDailyUsageRange(fromDate, toDate)
  
  if (results.length === 0) {
    return { totalKwh: 0, totalCharge: 0, days: 0, averageKwh: 0 }
  }
  
  const totalKwh = results.reduce((sum, record) => sum + record.kwhUsed, 0)
  const totalCharge = results.reduce((sum, record) => sum + record.chargeYen, 0)
  
  return {
    totalKwh,
    totalCharge,
    days: results.length,
    averageKwh: totalKwh / results.length
  }
}
