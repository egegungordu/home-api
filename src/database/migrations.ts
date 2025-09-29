import { db } from './db'

export function runMigrations(): void {
  db.run(`CREATE TABLE IF NOT EXISTS daily_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usage_date TEXT NOT NULL UNIQUE,
    kwh_used REAL NOT NULL,
    charge_yen INTEGER NOT NULL,
    cumulative_kwh REAL NOT NULL,
    cumulative_charge_yen INTEGER NOT NULL,
    billing_status TEXT,
    rate_category TEXT,
    last_updated TIMESTAMP NOT NULL,
    collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    raw_data TEXT
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS auth_sessions (
    id INTEGER PRIMARY KEY,
    session_data TEXT,
    bearer_token TEXT,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS collection_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_type TEXT NOT NULL,
    status TEXT NOT NULL,
    message TEXT,
    records_collected INTEGER DEFAULT 0,
    execution_time_ms INTEGER,
    error_details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`)
}

// Run migrations when this file is executed directly
runMigrations()
console.log('Migrations completed')


