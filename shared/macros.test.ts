import { describe, expect, it } from 'vitest'
import {
  divideMacros,
  macrosForQuantity,
  multiplyMacros,
  perServingMacros,
  sumMacros,
} from './macros'
import { chicken, rice } from './fixtures'

describe('macrosForQuantity', () => {
  it('scales per-100g values by quantity / 100 (140 g chicken, PRD §9.3)', () => {
    const m = macrosForQuantity(chicken.nutrition100g, 140)
    expect(m).toEqual({
      calories: 231,
      protein: 43.4,
      carbs: 0,
      fat: 5.04,
    })
  })

  it('returns the exact serving at 100 g', () => {
    const m = macrosForQuantity(chicken.nutrition100g, 100)
    expect(m).toEqual({ calories: 165, protein: 31, carbs: 0, fat: 3.6 })
  })

  it('returns null for missing nutrition', () => {
    expect(macrosForQuantity(null, 100)).toBeNull()
  })
})

describe('perServingMacros', () => {
  it('computes macros for the metric serving (85 g chicken)', () => {
    const m = perServingMacros(chicken)
    expect(m).toEqual({
      calories: 140.25,
      protein: 26.35,
      carbs: 0,
      fat: 3.06,
    })
  })

  it('returns null when serving or nutrition is missing', () => {
    expect(perServingMacros({ ...chicken, servingMetric: null })).toBeNull()
    expect(perServingMacros({ ...chicken, nutrition100g: null })).toBeNull()
  })
})

describe('recipe arithmetic', () => {
  const a = { calories: 100, protein: 10, carbs: 20, fat: 5 }
  const b = { calories: 50.5, protein: 1.25, carbs: 0, fat: 2.5 }

  it('sums ingredient macros deterministically', () => {
    expect(sumMacros([a, b])).toEqual({
      calories: 150.5,
      protein: 11.25,
      carbs: 20,
      fat: 7.5,
    })
  })

  it('divides by portions (perPortionMacros = sum ÷ portions)', () => {
    const total = sumMacros([a, b])
    expect(divideMacros(total, 3)).toEqual({
      calories: 50.17,
      protein: 3.75,
      carbs: 6.67,
      fat: 2.5,
    })
  })

  it('multiplies for logged portions', () => {
    expect(multiplyMacros(b, 2)).toEqual({
      calories: 101,
      protein: 2.5,
      carbs: 0,
      fat: 5,
    })
  })

  it('treats non-positive portions as zero', () => {
    expect(divideMacros(a, 0)).toEqual({
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    })
  })

  it('scales a household-anchored ingredient (1 cup rice)', () => {
    const m = macrosForQuantity(rice.nutrition100g, 160)
    expect(m).toEqual({ calories: 208, protein: 4.32, carbs: 44.8, fat: 0.48 })
  })
})
