import { Hono } from 'hono'
import { prettyJSON } from 'hono/pretty-json'
import api from './routes/api'
import electric from './routes/electric'
import { runMigrations } from './database/migrations'
import { registerJobs } from './scheduler/jobs'
import { StreamableHTTPTransport } from '@hono/mcp'
import { createMcpServer } from './mcp/server'

const app = new Hono()

app.use('*', prettyJSON())

// Initialize database
runMigrations()

// Initialize scheduler (only in production or when explicitly enabled)
if (process.env.BUN_ENV === 'production' || process.env.ENABLE_SCHEDULER === 'true') {
  registerJobs()
}

// Mount routes
app.route('/api', api)
app.route('/api/electric', electric)

app.get('/api/health', (c) => c.json({ status: 'ok' }))

// MCP endpoint
app.all('/mcp', async (c) => {
  const mcpServer = createMcpServer()
  const transport = new StreamableHTTPTransport()
  // @ts-ignore
  await mcpServer.connect(transport)
  return transport.handleRequest(c)
})

export default app

// // eslint-disable-next-line no-console
// console.log(`Home API listening on http://localhost:${port}`)


