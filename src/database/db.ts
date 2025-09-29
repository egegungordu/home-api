import { Database } from 'bun:sqlite'

const dbPath = process.env.DB_PATH ?? './data/tepco.db'

export const db = new Database(dbPath)


