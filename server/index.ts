/**
 * index.ts — MCP server (ADR-0020): thin transport wrapper around the shared
 * tool library. Streamable HTTP (chat clients + personal web app) and stdio.
 *
 * Usage:
 *   bun run server                 # streamable HTTP on :3000/mcp
 *   bun run server --host           # bind all interfaces (OpenWebUI on another machine)
 *   bun run server -- --stdio       # stdio transport
 *
 * Env (see .env.example; Bun auto-loads .env):
 *   NUTRITION_DB_PATH  path to opennutrition.sqlite (default server/data/)
 *   NUTRITION_PORT    HTTP port (default 3000)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import {
  searchIngredient,
  searchIngredientSchema,
  type FoodRepository,
} from '@nutrition-tracker/shared'
import { existsSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import { resolve } from 'node:path'
import { BunSqliteRepository } from './db'

const DB_PATH = resolve(
  process.env.NUTRITION_DB_PATH ?? 'server/data/opennutrition.sqlite',
)
const PORT = Number(process.env.NUTRITION_PORT ?? 3000)

/** Parse --host [address]; bare flag binds 0.0.0.0. */
function parseHost(argv: string[]): string | null {
  const i = argv.indexOf('--host')
  if (i === -1) return null
  const value = argv[i + 1]
  return value && !value.startsWith('-') ? value : '0.0.0.0'
}

/** Non-internal IPv4 /mcp URLs for other machines on the network. */
function lanUrls(port: number): string[] {
  const urls: string[] = []
  for (const ifaces of Object.values(networkInterfaces())) {
    for (const ni of ifaces ?? []) {
      if (ni.family === 'IPv4' && !ni.internal) {
        urls.push(`http://${ni.address}:${port}/mcp`)
      }
    }
  }
  return urls
}

function buildServer(repo: FoodRepository): McpServer {
  const server = new McpServer({ name: 'nutrition-tracker', version: '0.1.0' })

  server.registerTool(
    'searchIngredient',
    {
      description:
        'Search the OpenNutrition food dataset by name or alias (e.g. "grilled chicken ' +
        'breast" hits the cooked everyday entry). FTS5 BM25 over name, alternate names, ' +
        'and labels. Returns id, name, category, serving anchors, and per-serving ' +
        'macros. Use getIngredientMacros for full nutrient detail.',
      inputSchema: searchIngredientSchema,
    },
    async (args) => {
      const result = searchIngredient(args, repo)
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      }
    },
  )

  return server
}

async function main(): Promise<void> {
  if (!existsSync(DB_PATH)) {
    throw new Error(
      `SQLite DB not found: ${DB_PATH}\nBuild it with: bun run build:sqlite`,
    )
  }
  const repo = new BunSqliteRepository(DB_PATH)

  if (process.argv.includes('--stdio')) {
    const server = buildServer(repo)
    await server.connect(new StdioServerTransport())
    console.error('nutrition-tracker MCP: stdio transport ready')
    return
  }

  // Stateless streamable HTTP (ADR-0020): the SDK requires a fresh server +
  // transport per request in stateless mode ("stateless transport cannot be
  // reused across requests"). The readonly SQLite repo is shared.
  const handleMcp = async (req: Request): Promise<Response> => {
    const server = buildServer(repo)
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    })
    await server.connect(transport)
    return transport.handleRequest(req)
  }

  const host = parseHost(process.argv)
  Bun.serve({
    port: PORT,
    hostname: host ?? undefined,
    fetch: (req) => {
      const { pathname } = new URL(req.url)
      if (pathname === '/mcp' || pathname === '/mcp/') return handleMcp(req)
      return new Response('Not found', { status: 404 })
    },
  })

  console.log(`nutrition-tracker MCP: streamable HTTP on http://localhost:${PORT}/mcp`)
  if (host) {
    for (const url of lanUrls(PORT)) {
      console.log(`  LAN: ${url}`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
