/**
 * nutrition.ts — app-side copy of the shared full-nutrition arithmetic
 * (shared/nutrition.ts, ADR-0026), mirroring the utils/macros ↔ shared/macros
 * split: only measured values are real data (ADR-0023).
 */

import type { ServedNutrient } from '@nutrition-tracker/shared/types'
import type { Nutrition100g } from '@/types/domain'

/** Measured-only ServedNutrient[] → app Nutrition100g blob (ADR-0023). */
export function servedToNutrition(
  rows: ServedNutrient[] | null | undefined,
): Nutrition100g | undefined {
  if (!rows) return undefined
  const out: Nutrition100g = {}
  for (const n of rows) {
    if (n.measured && n.value !== null) out[n.key] = n.value
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/** Scale a per-100 g blob by quantity (factor = quantity / 100). */
export function foodNutritionForQuantity(
  nutrition100g: Nutrition100g | null | undefined,
  quantity: number,
): Nutrition100g | undefined {
  if (!nutrition100g) return undefined
  const factor = quantity / 100
  const out: Nutrition100g = {}
  for (const [key, value] of Object.entries(nutrition100g)) {
    if (value === undefined) continue
    out[key] = round2(value * factor)
  }
  return out
}

/** Multiply every defined key by n. */
export function multiplyNutrition(
  nutrition: Nutrition100g | undefined,
  n: number,
): Nutrition100g | undefined {
  if (!nutrition) return undefined
  const out: Nutrition100g = {}
  for (const [key, value] of Object.entries(nutrition)) {
    if (value === undefined) continue
    out[key] = round2(value * n)
  }
  return out
}

/** Union-sum blobs: every key present in any blob, summing defined values only. */
export function sumNutrition(blobs: Nutrition100g[]): Nutrition100g {
  const total: Nutrition100g = {}
  for (const blob of blobs) {
    for (const [key, value] of Object.entries(blob)) {
      if (value === undefined) continue
      total[key] = round2((total[key] ?? 0) + value)
    }
  }
  return total
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
