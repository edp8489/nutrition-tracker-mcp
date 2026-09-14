/**
 * smoke.ts — Phase-0 spike #1 client (ADR-0020): exercises the MCP server as
 * a real SDK client over both transports, covering all v1 tools against the
 * full dataset.
 *
 * Usage (server must be running for http mode):
 *   bun run server/smoke.ts stdio   # spawns server --stdio as a subprocess
 *   bun run server/smoke.ts http    # connects to http://localhost:3000/mcp
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const CHICKEN_ID = 'fd_2dObzdqa6o2J' // Chicken Breast, Boneless Skinless, Cooked
const RICE_ID = 'fd_gbtVB7G9twmc' // Rice, Cooked (1 cup = 160 g)

interface SearchHit {
  id: string
  name: string
  type: string | null
}

function toolText(result: unknown): string {
  const r = result as {
    isError?: boolean
    content?: Array<{ type: string; text?: string }>
  }
  const text = r.content?.find((c) => c.type === 'text')?.text
  if (r.isError || !text) {
    throw new Error(`tool call failed: ${JSON.stringify(result).slice(0, 300)}`)
  }
  return text
}

function parse<T>(text: string): T {
  return JSON.parse(text) as T
}

function assert(cond: boolean, message: string): void {
  if (!cond) throw new Error(`assertion failed: ${message}`)
}

async function exercise(client: Client, label: string): Promise<void> {
  const { tools } = await client.listTools()
  console.log(`[${label}] tools: ${tools.map((t) => t.name).join(', ')}`)
  assert(
    tools.map((t) => t.name).join(',') ===
      'searchIngredient,getIngredientMacros,computeRecipeMacros,filterFoods,convertUnits',
    'all 5 v1 tools registered',
  )

  // 1) searchIngredient — everyday boost (handoff finding)
  const search = parse<{ hits: SearchHit[] }>(
    toolText(
      await client.callTool({
        name: 'searchIngredient',
        arguments: { query: 'grilled chicken breast', limit: 5 },
      }),
    ),
  )
  console.log(`[${label}] search top: ${search.hits[0]?.name}`)
  assert(search.hits[0].type === 'everyday', 'everyday entry ranks first')
  assert(/chicken breast/i.test(search.hits[0].name), 'top hit is chicken breast')

  // 2) getIngredientMacros — measured flags + 3 oz normalization
  const macros = parse<{
    per100g: Array<{ key: string; measured: boolean; value: number | null }>
    requested: { quantity: number; unit: string; macros: { protein: number } | null }
    perServing: { quantity: number } | null
  }>(
    toolText(
      await client.callTool({
        name: 'getIngredientMacros',
        arguments: { id: CHICKEN_ID, quantity: 3, unit: 'oz' },
      }),
    ),
  )
  assert(macros.per100g[0].key === 'calories', 'core macros first')
  assert(
    macros.per100g.some((n) => n.key === 'caffeine' && !n.measured),
    'out-of-tier zero served as not-reported',
  )
  assert(
    macros.requested.unit === 'g' &&
      macros.requested.quantity > 84 &&
      macros.requested.quantity < 86,
    '3 oz normalized to ~85 g',
  )
  assert(
    macros.requested.macros !== null &&
      macros.requested.macros.protein > 25.5 &&
      macros.requested.macros.protein < 26.5,
    '3 oz protein ≈ 26 g',
  )
  console.log(
    `[${label}] getIngredientMacros: 3 oz → ${macros.requested.quantity} g, protein ${macros.requested.macros?.protein} g`,
  )

  // 3) computeRecipeMacros — chicken 85 g + 1 cup rice, 2 servings
  const recipe = parse<{
    totalMacros: { calories: number }
    perServingMacros: { protein: number } | null
  }>(
    toolText(
      await client.callTool({
        name: 'computeRecipeMacros',
        arguments: {
          ingredients: [
            { foodId: CHICKEN_ID, quantity: 85, unit: 'g' },
            { foodId: RICE_ID, quantity: 1, unit: 'cup' },
          ],
          servings: 2,
        },
      }),
    ),
  )
  assert(
    recipe.totalMacros.calories > 330 && recipe.totalMacros.calories < 345,
    'recipe total ≈ 336 kcal',
  )
  assert(
    recipe.perServingMacros !== null &&
      recipe.perServingMacros.protein > 14.5 &&
      recipe.perServingMacros.protein < 15.5,
    'per-serving protein ≈ 15.1 g',
  )
  console.log(
    `[${label}] computeRecipeMacros: total ${recipe.totalMacros.calories} kcal, per serving protein ${recipe.perServingMacros?.protein} g`,
  )

  // 4) filterFoods — high_protein preset, everyday
  const filtered = parse<{
    criteria: string[]
    foods: Array<{ name: string; value: number }>
    caveats: string[]
  }>(
    toolText(
      await client.callTool({
        name: 'filterFoods',
        arguments: { dietPreset: 'high_protein', category: 'everyday', limit: 5 },
      }),
    ),
  )
  assert(filtered.criteria[0].includes('≥ 20 g'), 'server-defined criteria surfaced')
  assert(
    filtered.foods.every((f) => f.value >= 20),
    'all values ≥ 20 g/100 g',
  )
  assert(filtered.caveats[0].includes('heuristic'), 'disclaimer present')
  console.log(
    `[${label}] filterFoods high_protein top: ${filtered.foods[0]?.name} (${filtered.foods[0]?.value} g)`,
  )

  // 5) convertUnits — household anchor both directions
  const toGrams = parse<{ quantity: number; unit: string }>(
    toolText(
      await client.callTool({
        name: 'convertUnits',
        arguments: { quantity: 1, from: 'cup', to: 'g', foodId: RICE_ID },
      }),
    ),
  )
  assert(toGrams.quantity === 160 && toGrams.unit === 'g', '1 cup rice = 160 g')
  const toCups = parse<{ quantity: number }>(
    toolText(
      await client.callTool({
        name: 'convertUnits',
        arguments: { quantity: 320, from: 'g', to: 'cup', foodId: RICE_ID },
      }),
    ),
  )
  assert(toCups.quantity === 2, '320 g rice = 2 cups')
  console.log(
    `[${label}] convertUnits: 1 cup → ${toGrams.quantity} g, 320 g → ${toCups.quantity} cups`,
  )

  console.log(`[${label}] PASS — all 5 v1 tools verified`)
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
