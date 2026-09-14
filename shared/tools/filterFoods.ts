/**
 * filterFoods — nutrient-range filtering + server-defined dietary presets
 * (ADR-0020 principle 4: the model never invents criteria). Presets are
 * heuristic thresholds on the per-100 g basis; gluten_free is best-effort
 * tag-absence from ingredient_analysis (ADR-0023).
 */

import type { FoodRepository, NutrientFilterRow } from '../adapter'
import { ATTRIBUTION } from '../attribution'
import { DIET_DISCLAIMER, DIET_PRESETS, GLUTEN_DISCLAIMER } from '../diets'
import { isMeasuredField } from '../measured'
import type { FilterFoodsParams, FilterFoodsResult, FilteredFood, Food } from '../types'

function clampLimit(limit: number | undefined): number {
  return Math.min(Math.max(limit ?? 10, 1), 50)
}

function toFiltered(food: Food, value: number | null): FilteredFood {
  return { id: food.id, name: food.name, type: food.type, value }
}

export function filterFoods(
  params: FilterFoodsParams,
  repo: FoodRepository,
): FilterFoodsResult {
  const hasNutrient = params.nutrient !== undefined
  const hasPreset = params.dietPreset !== undefined
  if (hasNutrient === hasPreset) {
    throw new Error('pass exactly one of: nutrient (with min and/or max) or dietPreset')
  }
  const limit = clampLimit(params.limit)
  const type = params.category ?? null

  if (hasPreset) {
    const preset = params.dietPreset as keyof typeof DIET_PRESETS
    const def = DIET_PRESETS[preset]

    if ('tag' in def) {
      const foods = repo.filterWithoutAnalysisTag(def.tag, { type, limit })
      return {
        filter: `${preset} (${def.label})`,
        criteria: [...def.criteria],
        foods: foods.map((f) => toFiltered(f, null)),
        caveats: [GLUTEN_DISCLAIMER],
        attribution: ATTRIBUTION,
      }
    }

    const rows = repo.filterByNutrient(def.nutrient, def.min ?? null, def.max ?? null, {
      type,
      limit,
    })
    return {
      filter: `${preset} (${def.label})`,
      criteria: [...def.criteria],
      foods: rows.map((r: NutrientFilterRow) => toFiltered(r.food, r.value)),
      caveats: [DIET_DISCLAIMER],
      attribution: ATTRIBUTION,
    }
  }

  const nutrient = params.nutrient as string
  if (params.min === undefined && params.max === undefined) {
    throw new Error('nutrient filter needs min and/or max (per 100 g)')
  }
  const caveats: string[] = []
  if (!isMeasuredField(nutrient)) {
    caveats.push(
      `${nutrient} is outside the reliably-measured tier (ADR-0023): unmeasured values ` +
        'are stored as 0 in the source data and pass a max filter unreliably',
    )
  }
  const range =
    params.min !== undefined && params.max !== undefined
      ? `${params.min}–${params.max}`
      : params.min !== undefined
        ? `≥ ${params.min}`
        : `≤ ${params.max}`
  const rows = repo.filterByNutrient(nutrient, params.min ?? null, params.max ?? null, {
    type,
    limit,
  })
  return {
    filter: `${nutrient} per 100 g: ${range}`,
    criteria: [`${nutrient} ${range} per 100 g`],
    foods: rows.map((r) => toFiltered(r.food, r.value)),
    caveats,
    attribution: ATTRIBUTION,
  }
}
