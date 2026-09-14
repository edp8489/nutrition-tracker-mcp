/**
 * index.ts — MCP server (ADR-0020): thin transport wrapper around the shared
 * tool library. Streamable HTTP (chat clients + personal web app) and stdio.
 *
 * Usage:
 *   bun run server                 # streamable HTTP on :3000/mcp
 *   bun run server -- --stdio      # stdio transport
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
import { resolve } from 'node:path'
import { BunSqliteRepository } from './db'

const DB_PATH = resolve(
  process.env.NUTRITION_DB_PATH ?? 'server/data/opennutrition.sqlite',
)
const PORT = Number(process.env.NUTRITION_PORT ?? 3000)

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

  Bun.serve({
    port: PORT,
    fetch: (req) => {
      const { pathname } = new URL(req.url)
      if (pathname === '/mcp' || pathname === '/mcp/') return handleMcp(req)
      return new Response('Not found', { status: 404 })
    },
  })

  console.log(`nutrition-tracker MCP: streamable HTTP on http://localhost:${PORT}/mcp`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
