import { describe, expect, it } from 'vitest'
import type { FoodRepository, NutrientFilterRow } from '../adapter'
import { filterFoods } from './filterFoods'
import { chicken, rice } from '../fixtures'

interface Calls {
  nutrient?: {
    nutrient: string
    min: number | null
    max: number | null
    type: string | null
  }
  tag?: { tag: string; type: string | null; limit: number }
}

function fakeRepo(
  nutrientRows: NutrientFilterRow[],
  tagFoods: (typeof rice)[],
): { repo: FoodRepository; calls: Calls } {
  const calls: Calls = {}
  const repo: FoodRepository = {
    getFoodById: () => null,
    search: () => [],
    filterByNutrient: (nutrient, min, max, options) => {
      calls.nutrient = {
        nutrient,
        min,
        max,
        type: options?.type ?? null,
      }
      return nutrientRows
    },
    filterWithoutAnalysisTag: (tag, options) => {
      calls.tag = { tag, type: options?.type ?? null, limit: options?.limit ?? 50 }
      return tagFoods
    },
  }
  return { repo, calls }
}

const rows: NutrientFilterRow[] = [
  { food: chicken, value: 31 },
  { food: rice, value: 25 },
]

describe('filterFoods', () => {
  it('applies server-defined keto thresholds (model never invents criteria)', () => {
    const { repo, calls } = fakeRepo(rows, [])
    const result = filterFoods({ dietPreset: 'keto', limit: 20 }, repo)
    expect(calls.nutrient).toEqual({
      nutrient: 'carbohydrates',
      min: null,
      max: 8,
      type: null,
    })
    expect(calls.nutrient?.max).toBe(8)
    expect(result.criteria).toEqual(['carbohydrates ≤ 8 g per 100 g'])
    expect(result.caveats[0]).toMatch(/server-defined heuristic/)
    expect(result.foods[0]).toEqual({
      id: chicken.id,
      name: chicken.name,
      type: 'everyday',
      value: 31,
    })
  })

  it('maps each preset to its nutrient thresholds with the disclaimer caveat', () => {
    const { repo, calls } = fakeRepo(rows, [])
    filterFoods({ dietPreset: 'low_sodium', category: 'grocery' }, repo)
    expect(calls.nutrient).toMatchObject({
      nutrient: 'sodium',
      max: 140,
      type: 'grocery',
    })
    const { repo: r2, calls: c2 } = fakeRepo(rows, [])
    filterFoods({ dietPreset: 'high_protein' }, r2)
    expect(c2.nutrient).toMatchObject({ nutrient: 'protein', min: 20, max: null })
  })

  it('routes gluten_free through tag absence with its own disclaimer', () => {
    const { repo, calls } = fakeRepo([], [rice])
    const result = filterFoods({ dietPreset: 'gluten_free', category: 'everyday' }, repo)
    expect(calls.tag).toEqual({ tag: 'gluten', type: 'everyday', limit: 10 })
    expect(result.foods[0].value).toBeNull()
    expect(result.caveats[0]).toMatch(/best-effort/)
  })

  it('filters by nutrient range and warns outside the measured tier', () => {
    const { repo, calls } = fakeRepo(rows, [])
    const result = filterFoods({ nutrient: 'sodium', max: 140, limit: 5 }, repo)
    expect(calls.nutrient).toEqual({
      nutrient: 'sodium',
      min: null,
      max: 140,
      type: null,
    })
    expect(result.caveats).toHaveLength(0)
    expect(result.filter).toBe('sodium per 100 g: ≤ 140')

    const { repo: r2 } = fakeRepo(rows, [])
    const caffeine = filterFoods({ nutrient: 'caffeine', max: 5 }, r2)
    expect(caffeine.caveats[0]).toMatch(/outside the reliably-measured tier/)
  })

  it('rejects ambiguous or incomplete filters', () => {
    const { repo } = fakeRepo(rows, [])
    expect(() => filterFoods({}, repo)).toThrow(/exactly one/)
    expect(() => filterFoods({ nutrient: 'protein', dietPreset: 'keto' }, repo)).toThrow(
      /exactly one/,
    )
    expect(() => filterFoods({ nutrient: 'protein' }, repo)).toThrow(/min and\/or max/)
  })
})
