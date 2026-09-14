import { describe, expect, it } from 'vitest'
import type { FoodRepository } from '../adapter'
import { computeRecipeMacros } from './computeRecipeMacros'
import { chicken, rice } from '../fixtures'

function repoFor(foods: Record<string, typeof chicken | null>): FoodRepository {
  return {
    getFoodById: (id) => foods[id] ?? null,
    search: () => [],
    filterByNutrient: () => [],
    filterWithoutAnalysisTag: () => [],
  }
}

const repo = repoFor({ [chicken.id]: chicken, [rice.id]: rice })

describe('computeRecipeMacros', () => {
  it('sums metric ingredients and divides by servings (deterministic)', () => {
    const result = computeRecipeMacros(
      {
        ingredients: [
          { foodId: chicken.id, quantity: 85, unit: 'g' },
          { foodId: rice.id, quantity: 1, unit: 'cup' },
        ],
        servings: 2,
      },
      repo,
    )
    expect(result.totalMacros).toEqual({
      calories: 348.25,
      protein: 30.67,
      carbs: 44.8,
      fat: 3.54,
    })
    expect(result.perServingMacros).toEqual({
      calories: 174.13,
      protein: 15.34,
      carbs: 22.4,
      fat: 1.77,
    })
    expect(result.ingredients).toHaveLength(2)
    expect(result.ingredients[1]).toMatchObject({ quantity: 160, unit: 'g' })
  })

  it('normalizes imperial and household units per ingredient', () => {
    const result = computeRecipeMacros(
      { ingredients: [{ foodId: chicken.id, quantity: 3, unit: 'oz' }], servings: 1 },
      repo,
    )
    expect(result.ingredients[0].quantity).toBeCloseTo(85.05, 1)
    expect(result.ingredients[0].macros?.protein).toBeCloseTo(26.37, 1)
  })

  it('excludes unknown foods from totals with a caveat', () => {
    const result = computeRecipeMacros(
      {
        ingredients: [
          { foodId: 'fd_nope', quantity: 100, unit: 'g' },
          { foodId: chicken.id, quantity: 100, unit: 'g' },
        ],
        servings: 1,
      },
      repo,
    )
    expect(result.totalMacros).toEqual({ calories: 165, protein: 31, carbs: 0, fat: 3.6 })
    expect(result.ingredients[0].note).toBe('food id not found')
    expect(result.caveats[0]).toContain('not found')
  })

  it('excludes ingredients with unconvertible household units', () => {
    const result = computeRecipeMacros(
      { ingredients: [{ foodId: chicken.id, quantity: 1, unit: 'cup' }], servings: 1 },
      repo,
    )
    expect(result.totalMacros).toBeNull()
    expect(result.caveats[0]).toContain('no household serving')
  })

  it('handles foods with no nutrition data', () => {
    const noNutrition = { ...chicken, nutrition100g: null }
    const repo2 = repoFor({ noNutrition: noNutrition })
    const result = computeRecipeMacros(
      { ingredients: [{ foodId: 'noNutrition', quantity: 100, unit: 'g' }], servings: 1 },
      repo2,
    )
    expect(result.totalMacros).toBeNull()
    expect(result.caveats[0]).toContain('no nutrition data')
  })

  it('rejects empty ingredient lists and non-positive servings', () => {
    expect(() => computeRecipeMacros({ ingredients: [], servings: 1 }, repo)).toThrow(
      /at least one/,
    )
    expect(() =>
      computeRecipeMacros(
        { ingredients: [{ foodId: chicken.id, quantity: 100, unit: 'g' }], servings: 0 },
        repo,
      ),
    ).toThrow(/servings/)
  })
})
