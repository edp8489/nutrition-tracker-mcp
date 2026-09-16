/**
 * computeRecipeMacros — deterministic recipe summation (ADR-0020: the most
 * important endpoint — summation must never happen in the model). Each
 * ingredient is normalized to metric (ADR-0024), scaled from the per-100 g
 * basis, summed, then divided by servings.
 */

import type { FoodRepository } from '../adapter'
import { ATTRIBUTION } from '../attribution'
import { divideMacros, macrosForQuantity, round2, sumMacros } from '../macros'
import {
  collectMeasuredNutrition,
  divideNutrition,
  nutritionForQuantity,
  servedNutrients,
  sumNutrition,
} from '../nutrition'
import { toMetric } from '../units'
import type {
  ComputeRecipeMacrosParams,
  ComputeRecipeMacrosResult,
  Macros,
  Nutrition100g,
  RecipeIngredientMacros,
} from '../types'

export function computeRecipeMacros(
  params: ComputeRecipeMacrosParams,
  repo: FoodRepository,
): ComputeRecipeMacrosResult {
  if (params.ingredients.length === 0) {
    throw new Error('recipe needs at least one ingredient')
  }
  if (!(params.servings >= 1)) {
    throw new Error('servings must be at least 1')
  }

  const caveats: string[] = []
  const parts: RecipeIngredientMacros[] = []
  const macrosList: Macros[] = []
  const measuredBlobs: Nutrition100g[] = []

  for (const ing of params.ingredients) {
    const food = repo.getFoodById(ing.foodId)
    if (!food) {
      parts.push({
        foodId: ing.foodId,
        foodName: null,
        quantity: ing.quantity,
        unit: 'g',
        macros: null,
        note: 'food id not found',
      })
      caveats.push(`ingredient "${ing.foodId}" not found — excluded from totals`)
      continue
    }

    const conv = toMetric(ing.quantity, ing.unit, food)
    if (!conv.ok) {
      parts.push({
        foodId: ing.foodId,
        foodName: food.name,
        quantity: ing.quantity,
        unit: 'g',
        macros: null,
        note: conv.error,
      })
      caveats.push(`${food.name}: ${conv.error} — excluded from totals`)
      continue
    }

    const macros = macrosForQuantity(food.nutrition100g, conv.quantity)
    if (!macros) {
      caveats.push(`${food.name}: no nutrition data reported — excluded from totals`)
    } else {
      macrosList.push(macros)
      const scaled = nutritionForQuantity(
        collectMeasuredNutrition(food.nutrition100g),
        conv.quantity,
      )
      if (scaled) measuredBlobs.push(scaled)
    }
    parts.push({
      foodId: ing.foodId,
      foodName: food.name,
      quantity: round2(conv.quantity),
      unit: conv.unit,
      macros,
      note: macros ? undefined : 'no nutrition data reported',
    })
  }

  const totalMacros = macrosList.length > 0 ? sumMacros(macrosList) : null
  const { total: summedNutrition, contributors } = sumNutrition(measuredBlobs)
  const hasNutrition = measuredBlobs.length > 0
  if (hasNutrition) {
    const partial = Object.entries(contributors).filter(
      ([, count]) => count > 0 && count < measuredBlobs.length,
    )
    if (partial.length > 0) {
      caveats.push(
        `${partial.length} nutrient field(s) not reported by every ingredient — ` +
          'their totals cover reporting ingredients only',
      )
    }
  }
  return {
    servings: params.servings,
    totalMacros,
    perServingMacros: totalMacros ? divideMacros(totalMacros, params.servings) : null,
    totalNutrition: hasNutrition ? servedNutrients(summedNutrition) : null,
    perServingNutrition: hasNutrition
      ? servedNutrients(divideNutrition(summedNutrition, params.servings))
      : null,
    ingredients: parts,
    caveats,
    attribution: ATTRIBUTION,
  }
}
