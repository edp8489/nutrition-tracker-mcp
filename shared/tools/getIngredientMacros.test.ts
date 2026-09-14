import { describe, expect, it } from 'vitest'
import type { FoodRepository } from '../adapter'
import { getIngredientMacros } from './getIngredientMacros'
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

describe('getIngredientMacros', () => {
  it('serves core macros first with units and measured flags', () => {
    const result = getIngredientMacros({ id: chicken.id }, repo)
    const keys = result.per100g.map((n) => n.key)
    expect(keys.slice(0, 4)).toEqual([
      'calories',
      'protein',
      'total_fat',
      'carbohydrates',
    ])
    const calories = result.per100g[0]
    expect(calories).toEqual({
      key: 'calories',
      value: 165,
      measured: true,
      unit: 'kcal',
    })
    const sodium = result.per100g.find((n) => n.key === 'sodium')
    expect(sodium).toEqual({ key: 'sodium', value: 74, measured: true, unit: 'mg' })
  })

  it('marks in-tier zeros measured but out-of-tier zeros not reported (ADR-0023)', () => {
    const result = getIngredientMacros({ id: chicken.id }, repo)
    const carbs = result.per100g.find((n) => n.key === 'carbohydrates')
    expect(carbs?.measured).toBe(true)
    const caffeine = result.per100g.find((n) => n.key === 'caffeine')
    expect(caffeine?.measured).toBe(false)
    expect(caffeine?.caveat).toContain('not reported')
    expect(result.caveats.some((c) => /not reported/.test(c))).toBe(true)
  })

  it('normalizes a requested imperial quantity server-side (3 oz chicken)', () => {
    const result = getIngredientMacros({ id: chicken.id, quantity: 3, unit: 'oz' }, repo)
    expect(result.requested?.unit).toBe('g')
    expect(result.requested?.quantity).toBeCloseTo(85.05, 1)
    expect(result.requested?.macros?.protein).toBeCloseTo(26.37, 1)
  })

  it('defaults quantity-less requests to per-serving plus per-100g', () => {
    const result = getIngredientMacros({ id: chicken.id }, repo)
    expect(result.requested).toBeNull()
    expect(result.perServing).toEqual({
      quantity: 85,
      unit: 'g',
      macros: { calories: 140.25, protein: 26.35, carbs: 0, fat: 3.06 },
    })
  })

  it('converts household quantities via the serving anchor (1 cup rice)', () => {
    const result = getIngredientMacros({ id: rice.id, quantity: 1, unit: 'cup' }, repo)
    expect(result.requested?.quantity).toBe(160)
    expect(result.requested?.macros?.carbs).toBe(44.8)
  })

  it('caveats when the household unit has no anchor', () => {
    const result = getIngredientMacros({ id: chicken.id, quantity: 1, unit: 'cup' }, repo)
    expect(result.requested).toBeNull()
    expect(result.caveats.some((c) => /no household serving/.test(c))).toBe(true)
  })

  it('reports unknown ids clearly', () => {
    const result = getIngredientMacros({ id: 'fd_nope' }, repo)
    expect(result.name).toBeNull()
    expect(result.caveats[0]).toContain('not found')
    expect(result.attribution.dataset).toBe('OpenNutrition')
  })
})
