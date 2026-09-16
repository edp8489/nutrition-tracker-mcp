/**
 * nutrition.ts — full-nutrition arithmetic over the open-ended nutrition100g
 * blob (ADR-0026): measured-only collection, scaling, union summation, and
 * ordered serving — all honoring measured-value semantics (ADR-0023).
 * Serves as the shared canonical implementation alongside macros.ts; the
 * frontend keeps a copy (utils/nutrition).
 */

import { round2 } from './macros'
import { serveNutrient } from './measured'
import type { Nutrition100g, ServedNutrient } from './types'

/** Units for nutrient fields the tools speak about most (dataset-native units). */
export const NUTRIENT_UNITS: Partial<Record<string, string>> = {
  calories: 'kcal',
  protein: 'g',
  total_fat: 'g',
  saturated_fats: 'g',
  monounsaturated_fats: 'g',
  polyunsaturated_fats: 'g',
  trans_fats: 'g',
  carbohydrates: 'g',
  dietary_fiber: 'g',
  soluble_fiber: 'g',
  insoluble_fiber: 'g',
  total_sugars: 'g',
  added_sugars: 'g',
  sugar_alcohols: 'g',
  ethyl_alcohol: 'g',
  water: 'g',
  sodium: 'mg',
  potassium: 'mg',
  calcium: 'mg',
  iron: 'mg',
  zinc: 'mg',
  magnesium: 'mg',
  phosphorus: 'mg',
  cholesterol: 'mg',
  caffeine: 'mg',
}

/** Core macros first, the rest in source order. */
export const CORE_FIRST = ['calories', 'protein', 'total_fat', 'carbohydrates']

/** Ordered, unit-annotated serving of a per-100 g blob (ADR-0023 flags kept). */
export function servedNutrients(per100g: Nutrition100g): ServedNutrient[] {
  const keys = Object.keys(per100g)
  const ordered = [
    ...CORE_FIRST.filter((k) => k in per100g),
    ...keys.filter((k) => !CORE_FIRST.includes(k)),
  ]
  return ordered.map((key) => {
    const served = serveNutrient(key, per100g[key])
    return served.value === null ? served : { ...served, unit: NUTRIENT_UNITS[key] }
  })
}

/**
 * Measured-only copy of a nutrition blob (ADR-0023): absent keys and
 * out-of-tier zeros (unmeasured) drop; in-tier zeros are real data and stay.
 */
export function collectMeasuredNutrition(nutrition: Nutrition100g | null): Nutrition100g {
  const out: Nutrition100g = {}
  if (!nutrition) return out
  for (const [key, value] of Object.entries(nutrition)) {
    const served = serveNutrient(key, value)
    if (served.measured && served.value !== null) out[key] = served.value
  }
  return out
}

/** Scale a per-100 g blob by quantity (factor = quantity / 100); null when no data. */
export function nutritionForQuantity(
  nutrition: Nutrition100g | null,
  quantity: number,
): Nutrition100g | null {
  if (!nutrition) return null
  const factor = quantity / 100
  const out: Nutrition100g = {}
  for (const [key, value] of Object.entries(nutrition)) {
    if (value === null || value === undefined) continue
    out[key] = round2(value * factor)
  }
  return out
}

export interface NutritionSum {
  total: Nutrition100g
  /** Per key: how many blobs contributed a defined value. */
  contributors: Record<string, number>
}

/** Union-sum blobs: every key present in any blob, summing defined values only. */
export function sumNutrition(blobs: Nutrition100g[]): NutritionSum {
  const total: Nutrition100g = {}
  const contributors: Record<string, number> = {}
  for (const blob of blobs) {
    for (const [key, value] of Object.entries(blob)) {
      if (value === null || value === undefined) continue
      total[key] = round2((total[key] ?? 0) + value)
      contributors[key] = (contributors[key] ?? 0) + 1
    }
  }
  return { total, contributors }
}

/** Divide every key by servings; non-positive servings zero all keys (mirrors divideMacros). */
export function divideNutrition(
  nutrition: Nutrition100g,
  servings: number,
): Nutrition100g {
  const out: Nutrition100g = {}
  for (const [key, value] of Object.entries(nutrition)) {
    if (value === null || value === undefined) continue
    out[key] = servings <= 0 ? 0 : round2(value / servings)
  }
  return out
}

/** Multiply every key by n (mirrors multiplyMacros). */
export function multiplyNutrition(nutrition: Nutrition100g, n: number): Nutrition100g {
  const out: Nutrition100g = {}
  for (const [key, value] of Object.entries(nutrition)) {
    if (value === null || value === undefined) continue
    out[key] = round2(value * n)
  }
  return out
}
