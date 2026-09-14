import { describe, expect, it } from 'vitest'
import { MEASURED_FIELDS, NOT_REPORTED, serveNutrient } from './measured'

describe('serveNutrient', () => {
  it('treats absent values as not reported', () => {
    expect(serveNutrient('calories', null)).toEqual({
      key: 'calories',
      value: null,
      measured: false,
      caveat: NOT_REPORTED,
    })
    expect(serveNutrient('iodine', undefined).measured).toBe(false)
  })

  it('serves in-tier values as measured', () => {
    const served = serveNutrient('sodium', 74)
    expect(served).toEqual({ key: 'sodium', value: 74, measured: true })
  })

  it('serves in-tier zeros as measured (plain chicken has 0 carbohydrates)', () => {
    const served = serveNutrient('carbohydrates', 0)
    expect(served.measured).toBe(true)
    expect(served.caveat).toBeUndefined()
  })

  it('serves out-of-tier zeros as not reported (chicken biotin/caffeine: 0)', () => {
    for (const key of ['biotin', 'caffeine', 'iodine']) {
      const served = serveNutrient(key, 0)
      expect(served.measured).toBe(false)
      expect(served.caveat).toBe(NOT_REPORTED)
    }
  })

  it('serves out-of-tier positive values as measured (caffeine in coffee)', () => {
    const served = serveNutrient('caffeine', 40)
    expect(served).toEqual({ key: 'caffeine', value: 40, measured: true })
  })

  it('covers the ADR-0023 tier list: energy, core macros, breakdowns, sodium, fiber, sugars', () => {
    for (const key of [
      'calories',
      'protein',
      'total_fat',
      'saturated_fats',
      'monounsaturated_fats',
      'polyunsaturated_fats',
      'trans_fats',
      'carbohydrates',
      'dietary_fiber',
      'total_sugars',
      'added_sugars',
      'sodium',
    ]) {
      expect(MEASURED_FIELDS).toContain(key)
    }
  })
})
