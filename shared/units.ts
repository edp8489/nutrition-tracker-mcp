/**
 * units.ts — unit conversion (ADR-0024).
 *
 * Storage stays metric-only (g/ml). Input accepts metric, imperial, and
 * household units:
 * - Pure unit conversions (g, ml, oz, lb, fl oz) use js-quantities.
 * - Household/count units ("1 cup rice", "2 large eggs") convert via the
 *   food's own serving anchor: servingMetric ÷ servingCommon. No density
 *   tables, ever.
 * - A food without a matching servingCommon returns "no household serving
 *   defined — provide grams".
 */

import Qty from 'js-quantities'
import type { Food, MetricUnit, PureUnit } from './types'

const PURE_UNITS = ['g', 'ml', 'oz', 'lb', 'fl_oz'] as const

/** js-quantities unit tokens (note: floz, not fl_oz). */
const QTY_UNIT: Record<PureUnit, string> = {
  g: 'g',
  ml: 'ml',
  oz: 'oz',
  lb: 'lb',
  fl_oz: 'floz',
}

export function isPureUnit(unit: string): unit is PureUnit {
  return (PURE_UNITS as readonly string[]).includes(unit)
}

/** Convert between pure units. Throws on mass ↔ volume. */
export function convertPure(quantity: number, from: PureUnit, to: PureUnit): number {
  return Qty(`${quantity} ${QTY_UNIT[from]}`).to(QTY_UNIT[to]).scalar
}

export const NO_HOUSEHOLD_SERVING =
  'no household serving defined for this food — provide grams (or ml)'

export type ToMetricResult =
  { ok: true; quantity: number; unit: MetricUnit } | { ok: false; error: string }

/**
 * Normalize any accepted unit to metric storage (g/ml).
 * Pure units convert via js-quantities; household units scale the food's
 * serving anchor (ADR-0024).
 */
export function toMetric(
  quantity: number,
  unit: string,
  food: Food | null = null,
): ToMetricResult {
  if (isPureUnit(unit)) {
    if (unit === 'g' || unit === 'ml') return { ok: true, quantity, unit }
    if (unit === 'fl_oz') {
      return { ok: true, quantity: convertPure(quantity, 'fl_oz', 'ml'), unit: 'ml' }
    }
    return { ok: true, quantity: convertPure(quantity, unit, 'g'), unit: 'g' }
  }
  const common = food?.servingCommon
  const metric = food?.servingMetric
  if (
    !common ||
    !metric ||
    !(common.quantity > 0) ||
    common.unit.trim().toLowerCase() !== unit.trim().toLowerCase()
  ) {
    return { ok: false, error: NO_HOUSEHOLD_SERVING }
  }
  return {
    ok: true,
    quantity: (metric.quantity / common.quantity) * quantity,
    unit: metric.unit,
  }
}
