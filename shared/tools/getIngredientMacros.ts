/**
 * getIngredientMacros — full nutrient detail with measured-value semantics
 * (ADR-0023): per-100 g values carry measured flags and phrasing guidance,
 * so the model can never assert "contains no X" from an unmeasured zero.
 * All scaling happens server-side (ADR-0020 principle 1).
 */

import type { FoodRepository } from '../adapter'
import { ATTRIBUTION } from '../attribution'
import { serveNutrient } from '../measured'
import { macrosForQuantity, perServingMacros, round2 } from '../macros'
import { toMetric } from '../units'
import type {
  GetIngredientMacrosParams,
  GetIngredientMacrosResult,
  Nutrition100g,
  ServedNutrient,
} from '../types'

/** Units for nutrient fields the tools speak about most (dataset-native units). */
const NUTRIENT_UNITS: Partial<Record<string, string>> = {
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
const CORE_FIRST = ['calories', 'protein', 'total_fat', 'carbohydrates']

function servedNutrients(per100g: Nutrition100g): ServedNutrient[] {
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

export function getIngredientMacros(
  params: GetIngredientMacrosParams,
  repo: FoodRepository,
): GetIngredientMacrosResult {
  const caveats: string[] = []
  const food = repo.getFoodById(params.id)
  if (!food) {
    return {
      id: params.id,
      name: null,
      per100g: [],
      requested: null,
      perServing: null,
      caveats: [`food id not found: ${params.id}`],
      attribution: ATTRIBUTION,
    }
  }

  const nutrition = food.nutrition100g
  const per100g = nutrition ? servedNutrients(nutrition) : []
  if (!nutrition) {
    caveats.push('no nutrition data reported for this food')
  } else {
    const unmeasured = per100g.filter((n) => !n.measured)
    if (unmeasured.length > 0) {
      caveats.push(
        `${unmeasured.length} of ${per100g.length} nutrient fields are not reported ` +
          'in the source data (absent or stored as 0 outside the measured tier); ' +
          'phrase them as "not reported" — never "contains none"',
      )
    }
  }

  let requested: GetIngredientMacrosResult['requested'] = null
  if (params.quantity !== undefined) {
    const conv = toMetric(params.quantity, params.unit ?? 'g', food)
    if (conv.ok) {
      requested = {
        quantity: round2(conv.quantity),
        unit: conv.unit,
        macros: macrosForQuantity(nutrition, conv.quantity),
      }
    } else {
      caveats.push(conv.error)
    }
  }

  const perServing = food.servingMetric
    ? {
        quantity: food.servingMetric.quantity,
        unit: food.servingMetric.unit,
        macros: perServingMacros(food),
      }
    : null

  return {
    id: food.id,
    name: food.name,
    per100g,
    requested,
    perServing,
    caveats,
    attribution: ATTRIBUTION,
  }
}
