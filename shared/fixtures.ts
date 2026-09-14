import type { Food } from './types'

/** Real everyday row (fd_2dObzdqa6o2J), nutrition trimmed to relevant keys. */
export const chicken: Food = {
  id: 'fd_2dObzdqa6o2J',
  name: 'Chicken Breast, Boneless Skinless, Cooked',
  altNames: ['grilled chicken breast', 'chicken breast'],
  description: null,
  type: 'everyday',
  source: null,
  servingMetric: { unit: 'g', quantity: 85 },
  servingCommon: { unit: 'oz', quantity: 3 },
  nutrition100g: {
    calories: 165,
    protein: 31,
    total_fat: 3.6,
    saturated_fats: 1,
    carbohydrates: 0,
    dietary_fiber: 0,
    total_sugars: 0,
    sodium: 74,
    caffeine: 0,
    biotin: 0,
  },
  ean13: null,
  labels: ['cooked'],
  packageSize: null,
  ingredients: null,
  ingredientAnalysis: {},
}

/** Household-anchor fixture: 1 cup cooked rice = 160 g (ADR-0024 example). */
export const rice: Food = {
  id: 'fd_rice',
  name: 'Rice, White, Cooked',
  altNames: ['white rice'],
  description: null,
  type: 'everyday',
  source: null,
  servingMetric: { unit: 'g', quantity: 160 },
  servingCommon: { unit: 'cup', quantity: 1 },
  nutrition100g: {
    calories: 130,
    protein: 2.7,
    total_fat: 0.3,
    carbohydrates: 28,
  },
  ean13: null,
  labels: ['cooked'],
  packageSize: null,
  ingredients: null,
  ingredientAnalysis: null,
}
