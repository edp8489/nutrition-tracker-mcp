/**
 * index.ts — MCP server (ADR-0020): thin transport wrapper around the shared
 * tool library. Streamable HTTP (chat clients + personal web app) and stdio.
 *
 * Usage:
 *   bun run server                 # streamable HTTP on :3000/mcp + dist/ statics
 *   bun run server -- --stdio      # stdio transport
 *
 * Also serves the built web app (dist/) at / and at the Vite base path
 * /nutrition-tracker/ — one process for API + app (ADR-0021).
 *
 * Env (see .env.example; Bun auto-loads .env):
 *   NUTRITION_DB_PATH  path to opennutrition.sqlite (default server/data/)
 *   NUTRITION_PORT    HTTP port (default 3000)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import {
  computeRecipeMacros,
  computeRecipeMacrosSchema,
  convertUnits,
  convertUnitsSchema,
  filterFoods,
  filterFoodsSchema,
  getIngredientMacros,
  getIngredientMacrosSchema,
  searchIngredient,
  searchIngredientSchema,
  type FoodRepository,
} from '@nutrition-tracker/shared'
import { existsSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { BunSqliteRepository } from './db'

const DB_PATH = resolve(
  process.env.NUTRITION_DB_PATH ?? 'server/data/opennutrition.sqlite',
)
const PORT = Number(process.env.NUTRITION_PORT ?? 3000)

const DIST = resolve('dist')
const BASE = '/nutrition-tracker' // Vite build base (ADR-0013)

const MIME: Record<string, string> = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.mjs': 'text/javascript',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
}

/**
 * Serve the built web app (ADR-0021): one process serves /mcp + dist/. The
 * web build's Vite base (/nutrition-tracker/, ADR-0013) is stripped so both /
 * and the subpath work; history-mode routes fall back to index.html.
 */
async function serveStatic(pathname: string): Promise<Response> {
  let path = pathname
  if (path === BASE || path.startsWith(`${BASE}/`)) path = path.slice(BASE.length)
  const file = resolve(DIST, path.replace(/^\/+/, '') || 'index.html')
  if (!file.startsWith(DIST + sep)) return new Response('Not found', { status: 404 })
  const f = Bun.file(file)
  if (await f.exists()) {
    const ext = file.slice(file.lastIndexOf('.'))
    return new Response(f, {
      headers: { 'content-type': MIME[ext] ?? 'application/octet-stream' },
    })
  }
  // History-mode SPA fallback (src/router) for extensionless paths; missing
  // assets 404 so the browser/PWA sees real errors.
  const last = path.slice(path.lastIndexOf('/') + 1)
  if (!last.includes('.')) {
    const index = Bun.file(join(DIST, 'index.html'))
    if (await index.exists()) {
      return new Response(index, { headers: { 'content-type': 'text/html' } })
    }
  }
  return new Response('Not found', { status: 404 })
}

/** Wrap a shared tool: result → JSON text; throw → isError result. */
function toolHandler<TParams>(
  fn: (params: TParams, repo: FoodRepository) => unknown,
  repo: FoodRepository,
) {
  return async (args: TParams) => {
    try {
      const result = fn(args, repo)
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      }
    } catch (err) {
      return {
        content: [
          {
            type: 'text' as const,
            text: err instanceof Error ? err.message : String(err),
          },
        ],
        isError: true,
      }
    }
  }
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
        'macros.',
      inputSchema: searchIngredientSchema,
    },
    toolHandler(searchIngredient, repo),
  )

  server.registerTool(
    'getIngredientMacros',
    {
      description:
        'Full nutrient detail for one food, with measured flags per value ' +
        '(unmeasured fields are "not reported", never "contains none"). Returns ' +
        'per-100 g values, macros for a requested quantity (any unit), and the ' +
        'metric serving. Use after searchIngredient.',
      inputSchema: getIngredientMacrosSchema,
    },
    toolHandler(getIngredientMacros, repo),
  )

  server.registerTool(
    'computeRecipeMacros',
    {
      description:
        'Deterministic recipe macro computation — all summation happens here, ' +
        'never in the model. Each ingredient is normalized to metric (household ' +
        "units like cups use the food's dataset serving anchor), summed, and " +
        'divided by servings.',
      inputSchema: computeRecipeMacrosSchema,
    },
    toolHandler(computeRecipeMacros, repo),
  )

  server.registerTool(
    'filterFoods',
    {
      description:
        'Filter foods by nutrient range per 100 g, or by a server-defined dietary ' +
        'preset (keto, low_sodium, low_carb, high_protein, gluten_free best-effort). ' +
        'The model never invents criteria — thresholds come from the server.',
      inputSchema: filterFoodsSchema,
    },
    toolHandler(filterFoods, repo),
  )

  server.registerTool(
    'convertUnits',
    {
      description:
        'Convert between metric, imperial, and household units. Pure units ' +
        '(g, ml, oz, lb, fl_oz) convert via js-quantities; household units ' +
        '(cup, slice, egg, …) require a foodId and use its dataset serving anchor.',
      inputSchema: convertUnitsSchema,
    },
    toolHandler(convertUnits, repo),
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
      return serveStatic(pathname)
    },
  })

  console.log(`nutrition-tracker MCP: streamable HTTP on http://localhost:${PORT}/mcp`)
  console.log(
    existsSync(join(DIST, 'index.html'))
      ? `nutrition-tracker MCP: dist/ served at / and ${BASE}/ (ADR-0021)`
      : 'nutrition-tracker MCP: dist/ missing — run `bun run build` to serve the web app',
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
