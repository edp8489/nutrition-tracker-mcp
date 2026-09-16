import { describe, expect, it } from 'vitest'
import { chicken } from './fixtures'
import {
  collectMeasuredNutrition,
  divideNutrition,
  multiplyNutrition,
  nutritionForQuantity,
  servedNutrients,
  sumNutrition,
} from './nutrition'

describe('collectMeasuredNutrition', () => {
  it('keeps tier-1 zeros as real data and drops out-of-tier zeros', () => {
    const measured = collectMeasuredNutrition(chicken.nutrition100g!)
    expect(measured.carbohydrates).toBe(0)
    expect(measured.sodium).toBe(74)
    expect('caffeine' in measured).toBe(false)
    expect('biotin' in measured).toBe(false)
  })

  it('returns an empty blob for null input', () => {
    expect(collectMeasuredNutrition(null)).toEqual({})
  })
})

describe('nutritionForQuantity', () => {
  it('scales every defined key by quantity / 100', () => {
    const scaled = nutritionForQuantity({ calories: 165, sodium: 74 }, 200)!
    expect(scaled.calories).toBe(330)
    expect(scaled.sodium).toBe(148)
  })

  it('returns null when there is no nutrition data', () => {
    expect(nutritionForQuantity(null, 100)).toBeNull()
  })
})

describe('sumNutrition', () => {
  it('unions keys and counts contributors per key', () => {
    const { total, contributors } = sumNutrition([
      { calories: 100, sodium: 10 },
      { calories: 50 },
      {},
    ])
    expect(total.calories).toBe(150)
    expect(total.sodium).toBe(10)
    expect(contributors.calories).toBe(2)
    expect(contributors.sodium).toBe(1)
  })
})

describe('divideNutrition / multiplyNutrition', () => {
  it('divides every key by servings (rounded to 2)', () => {
    expect(divideNutrition({ calories: 295, sodium: 74 }, 2)).toEqual({
      calories: 147.5,
      sodium: 37,
    })
  })

  it('zeroes all keys for non-positive servings, mirroring divideMacros', () => {
    expect(divideNutrition({ calories: 295 }, 0)).toEqual({ calories: 0 })
  })

  it('multiplies every key', () => {
    expect(multiplyNutrition({ calories: 147.5, sodium: 37 }, 2)).toEqual({
      calories: 295,
      sodium: 74,
    })
  })
})

describe('servedNutrients', () => {
  it('orders core fields first and attaches units', () => {
    const rows = servedNutrients({ sodium: 74, calories: 165, protein: 31 })
    expect(rows.map((r) => r.key)).toEqual(['calories', 'protein', 'sodium'])
    expect(rows[0].unit).toBe('kcal')
    expect(rows[2].unit).toBe('mg')
  })

  it('serves out-of-tier zeros as not-reported', () => {
    const rows = servedNutrients({ caffeine: 0 })
    expect(rows[0]).toMatchObject({ key: 'caffeine', value: 0, measured: false })
  })
})
