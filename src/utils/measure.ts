/**
 * measure.ts — input-boundary unit conversion (ADR-0024).
 *
 * Storage stays metric-only (g/ml). Household units convert through the
 * food's own serving anchors — never density tables:
 * - 'serving' scales `servingMetric`.
 * - 'cup'/'tbsp'/'tsp' scale `servingMetric ÷ servingCommon`, using the
 *   fixed household volume ratios (1 cup = 16 Tbsp = 48 tsp).
 */
import type { Food, HouseholdUnit, MeasureUnit, Unit } from '@/types/domain'

/** US customary household volumes (ml). */
const HOUSEHOLD_ML: Record<'cup' | 'tbsp' | 'tsp', number> = {
  cup: 236.588,
  tbsp: 236.588 / 16,
  tsp: 236.588 / 48,
}

export interface MetricAmount {
  quantity: number
  unit: Unit
}

export type ToMetricResult =
  | { ok: true; amount: MetricAmount }
  | { ok: false; error: string }

export const NO_HOUSEHOLD_SERVING =
  'no household serving defined for this food — provide grams (or ml)'

/** The food's household anchor if it is a volume measure (cup/Tbsp/tsp). */
function volumeAnchor(
  food: Food | null | undefined,
): { unit: 'cup' | 'tbsp' | 'tsp'; quantity: number } | null {
  const c = food?.servingCommon
  if (!c || !(c.quantity > 0)) return null
  const u = c.unit.trim().toLowerCase()
  if (u === 'cup' || u === 'tbsp' || u === 'tsp') return { unit: u, quantity: c.quantity }
  return null
}

/** Household units the food's anchors support (ADR-0024 unit picker). */
export function supportedHouseholdUnits(food: Food | null | undefined): HouseholdUnit[] {
  const units: HouseholdUnit[] = []
  if (food && food.servingMetric.quantity > 0) units.push('serving')
  if (volumeAnchor(food)) units.push('cup', 'tbsp', 'tsp')
  return units
}

/**
 * Normalize any input unit to metric storage (g/ml). Pure units pass
 * through; household units scale the food's serving anchors.
 */
export function toMetricAmount(
  quantity: number,
  unit: MeasureUnit,
  food: Food | null,
): ToMetricResult {
  if (unit === 'g' || unit === 'ml') return { ok: true, amount: { quantity, unit } }
  if (!food) return { ok: false, error: NO_HOUSEHOLD_SERVING }
  if (unit === 'serving') {
    const m = food.servingMetric
    if (!(m.quantity > 0)) return { ok: false, error: NO_HOUSEHOLD_SERVING }
    return { ok: true, amount: { quantity: quantity * m.quantity, unit: m.unit } }
  }
  const anchor = volumeAnchor(food)
  if (!anchor) return { ok: false, error: NO_HOUSEHOLD_SERVING }
  const m = food.servingMetric
  const anchorMl = HOUSEHOLD_ML[anchor.unit] * anchor.quantity
  const requestedMl = HOUSEHOLD_ML[unit] * quantity
  return {
    ok: true,
    amount: { quantity: (requestedMl / anchorMl) * m.quantity, unit: m.unit },
  }
}