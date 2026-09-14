/**
 * searchIngredient — hybrid search v1 (ADR-0025): FTS5 BM25 over weighted
 * name + altNames + labels (+ description/ingredients at lower weight) via
 * the storage adapter.
 *
 * The everyday boost lives HERE, in the tool layer, not in the index:
 * on the full dataset, unfiltered BM25 ranks long grocery brand names
 * above the everyday cooked entry for "grilled chicken breast" (the everyday
 * row matches but sits far below rank 50 — overfetching cannot reach it).
 * So when no category filter is given, the tool runs two adapter queries:
 * everyday rows first, then the unfiltered ranking, deduplicated.
 */

import type { FoodRepository, SearchRow } from '../adapter'
import { ATTRIBUTION } from '../attribution'
import { perServingMacros } from '../macros'
import type {
  Food,
  SearchHit,
  SearchIngredientParams,
  SearchIngredientResult,
} from '../types'

export const DEFAULT_SEARCH_LIMIT = 10

function toHit(food: Food, score: number): SearchHit {
  return {
    id: food.id,
    name: food.name,
    type: food.type,
    servingMetric: food.servingMetric,
    servingCommon: food.servingCommon,
    perServingMacros: perServingMacros(food),
    score,
  }
}

export function searchIngredient(
  params: SearchIngredientParams,
  repo: FoodRepository,
): SearchIngredientResult {
  const limit = Math.min(Math.max(params.limit ?? DEFAULT_SEARCH_LIMIT, 1), 50)
  const type = params.type ?? null

  let rows: SearchRow[]
  if (type) {
    rows = repo.search(params.query, { type, limit })
  } else {
    const everyday = repo.search(params.query, { type: 'everyday', limit })
    const seen = new Set(everyday.map((r) => r.food.id))
    const rest = repo.search(params.query, { limit }).filter((r) => !seen.has(r.food.id))
    rows = [...everyday, ...rest]
  }

  return {
    hits: rows.slice(0, limit).map((r) => toHit(r.food, r.score)),
    attribution: ATTRIBUTION,
  }
}
