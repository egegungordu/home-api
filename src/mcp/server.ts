import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import * as models from '../database/models'

export function createMcpServer() {
  const mcpServer = new McpServer({
    name: 'home-api-mcp',
    version: '1.0.0'
  })

  mcpServer.registerTool(
    'electric_getDailyUsageRange',
    {
      title: 'Get electric daily usage in range',
      description: 'Returns daily electricity usage between from and to (inclusive). Dates are YYYYMMDD.',
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      },
      inputSchema: {
        from: z.string().regex(/^\d{8}$/).describe('From date in YYYYMMDD'),
        to: z.string().regex(/^\d{8}$/).describe('To date in YYYYMMDD')
      },
      outputSchema: {
        results: z
          .array(
            z.object({
              usageDate: z.string(),
              kwhUsed: z.number(),
              chargeYen: z.number(),
              cumulativeKwh: z.number(),
              cumulativeChargeYen: z.number(),
              billingStatus: z.string().nullable(),
              rateCategory: z.string().nullable()
            })
          )
          .describe('Array of daily usage records ordered by date')
      }
    },
    async ({ from, to }) => {
      const rows = await models.getDailyUsageRange(from, to)
      const results = rows.map((r) => ({
        usageDate: r.usageDate,
        kwhUsed: r.kwhUsed,
        chargeYen: r.chargeYen,
        cumulativeKwh: r.cumulativeKwh,
        cumulativeChargeYen: r.cumulativeChargeYen,
        billingStatus: r.billingStatus ?? null,
        rateCategory: r.rateCategory ?? null
      }))

      const structuredContent = { results }

      // print type of rows
      console.log(rows[0])
      console.log(typeof rows[0])

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(structuredContent)
          }
        ],
        structuredContent
      }
    }
  )

  return mcpServer
}


