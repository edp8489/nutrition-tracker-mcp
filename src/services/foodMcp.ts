/**
 * foodMcp.ts — typed wrappers over the MCP tools the web app uses
 * (ADR-0021), mapping shared tool contracts to the app's domain types.
 *
 * Only `searchIngredient`, `getIngredientMacros`, and `computeRecipeMacros`
 * are consumed by the UI; `filterFoods`/`convertUnits` serve chat clients
 * (ADR-0020) and can be wired up later if features need them.
 */

import type {
  ComputeRecipeMacrosResult,
  GetIngredientMacrosResult,
  SearchHit,
  SearchIngredientResult,
} from '@nutrition-tracker/shared/types'
import { callTool } from './mcp'
import type { Food, FoodType, Ingredient, Nutrition100g } from '@/types/domain'

export function searchIngredients(
  query: string,
  type?: FoodType,
  limit = 50,
): Promise<SearchIngredientResult> {
  return callTool<SearchIngredientResult>('searchIngredient', {
    query,
    ...(type ? { type } : {}),
    limit,
  })
}

export function getIngredientMacros(id: string): Promise<GetIngredientMacrosResult> {
  return callTool<GetIngredientMacrosResult>('getIngredientMacros', { id })
}

export function computeRecipe(
  ingredients: Ingredient[],
  servings: number,
): Promise<ComputeRecipeMacrosResult> {
  return callTool<ComputeRecipeMacrosResult>('computeRecipeMacros', {
    ingredients: ingredients.map((i) => ({
      foodId: i.foodId,
      quantity: i.quantity,
      unit: i.unit,
    })),
    servings,
  })
}

/** Search hit → app Food. Macros are per-serving only until getDetail(). */
export function hitToFood(hit: SearchHit): Food {
  return {
    id: hit.id,
    name: hit.name,
    altNames: [],
    type: hit.type,
    servingMetric: hit.servingMetric ?? { unit: 'g', quantity: 100 },
    servingCommon: hit.servingCommon,
    perServingMacros: hit.perServingMacros,
    nutrition100g: undefined,
  }
}

/** getIngredientMacros result → full app Food (per-100 g + metric serving). */
export function detailToFood(result: GetIngredientMacrosResult, hit?: Food): Food {
  // ADR-0023: only measured values are real data. The four MVP macros fall
  // back to 0 in the math layer (utils/macros) — the app has no "not
  // reported" UI yet; core macros are tier-1 measured.
  const nutrition100g: Nutrition100g = {}
  for (const n of result.per100g) {
    if (n.measured && n.value !== null) nutrition100g[n.key] = n.value
  }
  return {
    id: result.id,
    name: result.name ?? hit?.name ?? result.id,
    altNames: [],
    type: hit?.type ?? null,
    servingMetric:
      result.perServing?.quantity && result.perServing.unit
        ? { unit: result.perServing.unit, quantity: result.perServing.quantity }
        : (hit?.servingMetric ?? { unit: 'g', quantity: 100 }),
    // Spread copies: reactive proxies are not structured-cloneable into
    // IndexedDB (DataCloneError) — never pass a store proxy through by ref
    servingCommon: hit?.servingCommon ? { ...hit.servingCommon } : null,
    perServingMacros:
      result.perServing?.macros ??
      (hit?.perServingMacros ? { ...hit.perServingMacros } : null),
    nutrition100g,
  }
}
