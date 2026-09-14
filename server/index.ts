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
import { resolve } from 'node:path'
import { BunSqliteRepository } from './db'

const DB_PATH = resolve(
  process.env.NUTRITION_DB_PATH ?? 'server/data/opennutrition.sqlite',
)
const PORT = Number(process.env.NUTRITION_PORT ?? 3000)

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
      return new Response('Not found', { status: 404 })
    },
  })

  console.log(`nutrition-tracker MCP: streamable HTTP on http://localhost:${PORT}/mcp`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
