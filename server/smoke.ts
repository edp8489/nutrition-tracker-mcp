/**
 * smoke.ts — Phase-0 spike #1 client (ADR-0020): exercises the MCP server as
 * a real SDK client over both transports.
 *
 * Usage (server must be running for http mode):
 *   bun run server/smoke.ts stdio   # spawns server --stdio as a subprocess
 *   bun run server/smoke.ts http    # connects to http://localhost:3000/mcp
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

interface Hit {
  id: string
  name: string
  type: string | null
  perServingMacros: unknown
}

async function exercise(client: Client, label: string): Promise<void> {
  const { tools } = await client.listTools()
  console.log(`[${label}] tools: ${tools.map((t) => t.name).join(', ')}`)

  const result = await client.callTool({
    name: 'searchIngredient',
    arguments: { query: 'grilled chicken breast', limit: 5 },
  })
  if (result.isError) {
    throw new Error(`tool call failed: ${JSON.stringify(result.content)}`)
  }
  const text = (result.content as Array<{ type: string; text?: string }>).find(
    (c) => c.type === 'text',
  )?.text
  if (!text) throw new Error('no text content in tool result')
  const parsed = JSON.parse(text) as { hits: Hit[]; attribution: unknown }

  console.log(`[${label}] top hits:`)
  for (const hit of parsed.hits.slice(0, 3)) {
    console.log(`  ${hit.type ?? '?'.padEnd(9)} | ${hit.name}`)
  }

  const top = parsed.hits[0]
  if (!top || top.type !== 'everyday' || !/chicken breast/i.test(top.name)) {
    throw new Error(
      'everyday boost failed: top hit is not the cooked everyday chicken entry',
    )
  }
  if (
    !parsed.attribution ||
    (parsed.attribution as { dataset?: string }).dataset !== 'OpenNutrition'
  ) {
    throw new Error('attribution missing from tool result')
  }
  console.log(`[${label}] PASS — everyday boost + attribution verified`)
}

async function main(): Promise<void> {
  const mode = process.argv[2] ?? 'stdio'

  if (mode === 'stdio') {
    const transport = new StdioClientTransport({
      command: 'bun',
      args: ['run', 'server/index.ts', '--stdio'],
      cwd: new URL('../', import.meta.url).pathname,
    })
    const client = new Client({ name: 'smoke', version: '0.1.0' })
    await client.connect(transport)
    await exercise(client, 'stdio')
    await client.close()
  } else {
    const url = new URL(`http://localhost:${process.env.NUTRITION_PORT ?? 3000}/mcp`)
    const transport = new StreamableHTTPClientTransport(url)
    const client = new Client({ name: 'smoke', version: '0.1.0' })
    await client.connect(transport)
    await exercise(client, 'http')
    await client.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
