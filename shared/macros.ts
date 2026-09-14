/**
 * macros.ts — deterministic macro arithmetic (PRD §9.3).
 *
 * All arithmetic is server-side (ADR-0020 principle 1): the model never
 * multiplies. Food entry macros = nutrition100g × (quantity / 100) — ml
 * quantities follow the dataset's per-100g convention. Serves as the shared
 * canonical implementation; the frontend keeps a copy until the
 * personal-variant swap.
 */

import type { Food, Macros, Nutrition100g } from './types'

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function macrosForQuantity(
  nutrition: Nutrition100g | null,
  quantity: number,
): Macros | null {
  if (!nutrition) return null
  const factor = quantity / 100
  return {
    calories: round2((nutrition.calories ?? 0) * factor),
    protein: round2((nutrition.protein ?? 0) * factor),
    carbs: round2((nutrition.carbohydrates ?? 0) * factor),
    fat: round2((nutrition.total_fat ?? 0) * factor),
  }
}

/** Macros for one metric serving of the food (null when serving/nutrition missing). */
export function perServingMacros(food: Food): Macros | null {
  if (!food.servingMetric) return null
  return macrosForQuantity(food.nutrition100g, food.servingMetric.quantity)
}

export function sumMacros(macros: Macros[]): Macros {
  return macros.reduce(
    (acc, m) => ({
      calories: round2(acc.calories + m.calories),
      protein: round2(acc.protein + m.protein),
      carbs: round2(acc.carbs + m.carbs),
      fat: round2(acc.fat + m.fat),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )
}

export function divideMacros(m: Macros, portions: number): Macros {
  if (portions <= 0) return { calories: 0, protein: 0, carbs: 0, fat: 0 }
  return {
    calories: round2(m.calories / portions),
    protein: round2(m.protein / portions),
    carbs: round2(m.carbs / portions),
    fat: round2(m.fat / portions),
  }
}

export function multiplyMacros(m: Macros, n: number): Macros {
  return {
    calories: round2(m.calories * n),
    protein: round2(m.protein * n),
    carbs: round2(m.carbs * n),
    fat: round2(m.fat * n),
  }
}
