import { describe, expect, it } from 'vitest'
import type { FoodRepository, SearchOptions, SearchRow } from '../adapter'
import { searchIngredient } from './searchIngredient'
import { chicken, rice } from '../fixtures'

const groceryChicken: SearchRow = {
  food: {
    ...chicken,
    id: 'fd_grocery',
    name: 'Great Value Grilled Chicken Breast Strips, Family Size',
    type: 'grocery',
  },
  score: -30,
}

const everydayChicken: SearchRow = { food: chicken, score: -22 }
const everydayRice: SearchRow = { food: rice, score: -0.5 }

interface FakeRepo {
  repo: FoodRepository
  calls: Array<{ type: string | null; limit: number | undefined }>
}

/** Routes by options.type: 'everyday' key, null → 'all' key. */
function fakeRepo(byType: Record<string, SearchRow[]>): FakeRepo {
  const calls: FakeRepo['calls'] = []
  const repo: FoodRepository = {
    getFoodById: () => null,
    search: (_query: string, options?: SearchOptions) => {
      calls.push({ type: options?.type ?? null, limit: options?.limit })
      if (options?.type) return byType[options.type] ?? []
      return byType.all ?? []
    },
    filterByNutrient: () => [],
  }
  return { repo, calls }
}

describe('searchIngredient', () => {
  it('promotes everyday rows above grocery when no type filter (handoff finding)', () => {
    const { repo, calls } = fakeRepo({
      everyday: [everydayChicken],
      all: [groceryChicken, everydayChicken],
    })
    const result = searchIngredient({ query: 'grilled chicken breast' }, repo)
    expect(result.hits[0].id).toBe(chicken.id)
    expect(result.hits[0].type).toBe('everyday')
    expect(result.hits[1].id).toBe('fd_grocery')
    // two adapter queries: everyday first, then unfiltered
    expect(calls).toEqual([
      { type: 'everyday', limit: 10 },
      { type: null, limit: 10 },
    ])
  })

  it('preserves BM25 order within each group and dedups across queries', () => {
    const bestEveryday: SearchRow = { food: chicken, score: -25 }
    const { repo } = fakeRepo({
      everyday: [bestEveryday, everydayRice],
      all: [groceryChicken, bestEveryday],
    })
    const result = searchIngredient({ query: 'chicken' }, repo)
    expect(result.hits.map((h) => h.id)).toEqual([chicken.id, rice.id, 'fd_grocery'])
  })

  it('falls back to pure BM25 order when nothing everyday matches', () => {
    const { repo, calls } = fakeRepo({ all: [groceryChicken] })
    const result = searchIngredient({ query: 'cheerios' }, repo)
    expect(result.hits.map((h) => h.id)).toEqual(['fd_grocery'])
    expect(calls[0].type).toBe('everyday')
  })

  it('uses a single filtered query when a type filter is given (no boost)', () => {
    const { repo, calls } = fakeRepo({
      grocery: [groceryChicken],
    })
    const result = searchIngredient(
      { query: 'grilled chicken breast', type: 'grocery' },
      repo,
    )
    expect(calls).toEqual([{ type: 'grocery', limit: 10 }])
    expect(result.hits[0].id).toBe('fd_grocery')
  })

  it('clamps the limit to 1..50 and passes it to both queries', () => {
    const { repo, calls } = fakeRepo({})
    searchIngredient({ query: 'x', limit: 500 }, repo)
    expect(calls).toEqual([
      { type: 'everyday', limit: 50 },
      { type: null, limit: 50 },
    ])
    const { repo: repo2 } = fakeRepo({
      everyday: [everydayChicken, everydayRice],
      all: [groceryChicken],
    })
    expect(searchIngredient({ query: 'x', limit: 1 }, repo2).hits).toHaveLength(1)
  })

  it('returns per-serving macros computed server-side', () => {
    const { repo } = fakeRepo({ everyday: [everydayChicken] })
    const result = searchIngredient({ query: 'chicken breast' }, repo)
    expect(result.hits[0].perServingMacros).toEqual({
      calories: 140.25,
      protein: 26.35,
      carbs: 0,
      fat: 3.06,
    })
  })

  it('embeds dataset attribution (ADR-0008)', () => {
    const { repo } = fakeRepo({ everyday: [everydayChicken] })
    const result = searchIngredient({ query: 'chicken' }, repo)
    expect(result.attribution.dataset).toBe('OpenNutrition')
    expect(result.attribution.license).toBe('ODbL')
  })
})
