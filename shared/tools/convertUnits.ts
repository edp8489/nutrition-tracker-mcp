/**
 * convertUnits — unit conversion (ADR-0024). Pure units (g, ml, oz, lb,
 * fl oz) via js-quantities; household units via the food's serving anchor
 * (requires foodId). Storage stays metric; this tool normalizes at the
 * boundary so the model never multiplies.
 */

import type { FoodRepository } from '../adapter'
import { ATTRIBUTION } from '../attribution'
import { round2 } from '../macros'
import { NO_HOUSEHOLD_SERVING, convertPure, isPureUnit, toMetric } from '../units'
import type { ConvertUnitsParams, ConvertUnitsResult } from '../types'

export function convertUnits(
  params: ConvertUnitsParams,
  repo: FoodRepository,
): ConvertUnitsResult {
  const { quantity, from, to, foodId } = params
  const food = foodId ? repo.getFoodById(foodId) : null
  if (foodId && !food) {
    throw new Error(`food id not found: ${foodId}`)
  }

  const source = toMetric(quantity, from, food)
  if (!source.ok) {
    const error =
      !isPureUnit(from) && !foodId
        ? `${source.error} — provide a foodId for household units`
        : source.error
    return { quantity: null, unit: null, error, attribution: ATTRIBUTION }
  }

  const anchorNote = (): string | undefined => {
    const common = food?.servingCommon
    const metric = food?.servingMetric
    if (!common || !metric) return undefined
    return `using this food's dataset serving anchor: ${common.quantity} ${common.unit} = ${metric.quantity} ${metric.unit}`
  }

  if (isPureUnit(to)) {
    try {
      const out = convertPure(source.quantity, source.unit, to)
      return {
        quantity: round2(out),
        unit: to,
        note: isPureUnit(from) ? undefined : anchorNote(),
        attribution: ATTRIBUTION,
      }
    } catch {
      return {
        quantity: null,
        unit: null,
        error: `incompatible dimensions: ${from} cannot be converted to ${to} (mass ↔ volume)`,
        attribution: ATTRIBUTION,
      }
    }
  }

  // Target is household: invert the food's serving anchor.
  const common = food?.servingCommon
  const metric = food?.servingMetric
  if (
    !common ||
    !metric ||
    !(common.quantity > 0) ||
    common.unit.trim().toLowerCase() !== to.trim().toLowerCase()
  ) {
    return {
      quantity: null,
      unit: null,
      error:
        NO_HOUSEHOLD_SERVING + (foodId ? '' : ' — provide a foodId for household units'),
      attribution: ATTRIBUTION,
    }
  }
  if (metric.unit !== source.unit) {
    return {
      quantity: null,
      unit: null,
      error: `the "${to}" serving for this food is anchored in ${metric.unit}, but the source resolved to ${source.unit}`,
      attribution: ATTRIBUTION,
    }
  }

  const gramsPerCommon = metric.quantity / common.quantity
  return {
    quantity: round2(source.quantity / gramsPerCommon),
    unit: common.unit,
    note: anchorNote(),
    attribution: ATTRIBUTION,
  }
}
