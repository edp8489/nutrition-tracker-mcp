/**
 * measured.ts — measured-value semantics (ADR-0023).
 *
 * The source dataset stores unmeasured nutrients as explicit 0 (e.g. chicken
 * breast reports biotin: 0, caffeine: 0). A per-field tier map defines which
 * fields are "reliably measured" (core macros, energy, fat/carbohydrate
 * breakdown, sodium, fiber, sugars). Out-of-tier explicit zeros are served with
 * measured: false and phrasing guidance, so an answer says "not reported"
 * rather than "contains none".
 */

import type { ServedNutrient } from './types'

/** Nutrient fields considered reliably measured (tier map, ADR-0023). */
export const MEASURED_FIELDS = [
  'calories',
  'protein',
  'total_fat',
  'saturated_fats',
  'monounsaturated_fats',
  'polyunsaturated_fats',
  'trans_fats',
  'carbohydrates',
  'dietary_fiber',
  'soluble_fiber',
  'insoluble_fiber',
  'total_sugars',
  'added_sugars',
  'sodium',
  'ethyl_alcohol',
] as const

const measuredSet = new Set<string>(MEASURED_FIELDS)

export const NOT_REPORTED =
  'not reported in the dataset — do not state that the food contains none'

export function isMeasuredField(key: string): boolean {
  return measuredSet.has(key)
}

/**
 * Serve a nutrient value with measured-value semantics:
 * - absent (null/undefined) → not reported
 * - in-tier value → measured (zeros are real: plain chicken has 0 carbohydrates)
 * - out-of-tier zero → not reported (unmeasured zeros are stored as 0)
 * - out-of-tier positive → measured (a real observation, e.g. caffeine in coffee)
 */
export function serveNutrient(
  key: string,
  value: number | null | undefined,
): ServedNutrient {
  if (value === null || value === undefined) {
    return { key, value: null, measured: false, caveat: NOT_REPORTED }
  }
  if (measuredSet.has(key)) {
    return { key, value, measured: true }
  }
  if (value === 0) {
    return { key, value: 0, measured: false, caveat: NOT_REPORTED }
  }
  return { key, value, measured: true }
}
