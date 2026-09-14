import { describe, expect, it } from 'vitest'
import type { FoodRepository } from '../adapter'
import { convertUnits } from './convertUnits'
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

describe('convertUnits', () => {
  it('converts pure units both directions', () => {
    expect(convertUnits({ quantity: 3, from: 'oz', to: 'g' }, repo)).toMatchObject({
      quantity: 85.05,
      unit: 'g',
    })
    expect(convertUnits({ quantity: 1, from: 'lb', to: 'g' }, repo)).toMatchObject({
      quantity: 453.59,
    })
    expect(convertUnits({ quantity: 2, from: 'fl_oz', to: 'ml' }, repo)).toMatchObject({
      quantity: 59.15,
    })
    expect(convertUnits({ quantity: 85, from: 'g', to: 'oz' }, repo)).toMatchObject({
      quantity: 3,
    })
  })

  it('rejects mass to volume with a clear error', () => {
    const result = convertUnits({ quantity: 1, from: 'oz', to: 'ml' }, repo)
    expect(result.quantity).toBeNull()
    expect(result.error).toMatch(/incompatible dimensions/)
  })

  it('converts household to metric via the serving anchor (1 cup rice)', () => {
    const result = convertUnits(
      { quantity: 1, from: 'cup', to: 'g', foodId: rice.id },
      repo,
    )
    expect(result).toMatchObject({ quantity: 160, unit: 'g' })
    expect(result.note).toContain('1 cup = 160 g')
  })

  it('inverts the anchor (320 g rice to cups)', () => {
    const result = convertUnits(
      { quantity: 320, from: 'g', to: 'cup', foodId: rice.id },
      repo,
    )
    expect(result).toMatchObject({ quantity: 2, unit: 'cup' })
  })

  it('errors on household units without a foodId or matching anchor', () => {
    const noId = convertUnits({ quantity: 1, from: 'cup', to: 'g' }, repo)
    expect(noId.error).toContain('provide a foodId')
    const wrongFood = convertUnits(
      { quantity: 1, from: 'cup', to: 'g', foodId: chicken.id },
      repo,
    )
    expect(wrongFood.error).toContain('no household serving')
  })

  it('rejects unknown food ids', () => {
    expect(() =>
      convertUnits({ quantity: 1, from: 'cup', to: 'g', foodId: 'fd_nope' }, repo),
    ).toThrow(/not found/)
  })

  it('flags anchor-dimension mismatches (fl oz of a mass-anchored food)', () => {
    const result = convertUnits(
      { quantity: 8, from: 'fl_oz', to: 'cup', foodId: rice.id },
      repo,
    )
    expect(result.error).toContain('anchored in g')
  })

  it('always embeds attribution', () => {
    expect(
      convertUnits({ quantity: 1, from: 'g', to: 'oz' }, repo).attribution.license,
    ).toBe('ODbL')
  })
})
