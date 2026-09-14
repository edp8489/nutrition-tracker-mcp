import { describe, expect, it } from 'vitest'
import { NO_HOUSEHOLD_SERVING, convertPure, isPureUnit, toMetric } from './units'
import { chicken, rice } from './fixtures'

describe('isPureUnit', () => {
  it('accepts the five pure units', () => {
    for (const u of ['g', 'ml', 'oz', 'lb', 'fl_oz']) {
      expect(isPureUnit(u)).toBe(true)
    }
  })

  it('rejects household units', () => {
    expect(isPureUnit('cup')).toBe(false)
    expect(isPureUnit('large egg')).toBe(false)
  })
})

describe('convertPure', () => {
  it('converts oz to g (dataset anchor: 3 oz = 85 g)', () => {
    expect(convertPure(3, 'oz', 'g')).toBeCloseTo(85.05, 1)
  })

  it('converts lb to g', () => {
    expect(convertPure(1, 'lb', 'g')).toBeCloseTo(453.59, 1)
  })

  it('converts fl_oz to ml', () => {
    expect(convertPure(2, 'fl_oz', 'ml')).toBeCloseTo(59.15, 1)
  })

  it('converts back g to oz', () => {
    expect(convertPure(85, 'g', 'oz')).toBeCloseTo(2.998, 2)
  })

  it('throws on mass to volume', () => {
    expect(() => convertPure(1, 'oz', 'ml')).toThrow(/Incompatible units/)
  })
})

describe('toMetric', () => {
  it('passes metric units through', () => {
    expect(toMetric(140, 'g')).toEqual({ ok: true, quantity: 140, unit: 'g' })
    expect(toMetric(240, 'ml')).toEqual({ ok: true, quantity: 240, unit: 'ml' })
  })

  it('converts imperial pure units', () => {
    const oz = toMetric(3, 'oz')
    expect(oz.ok).toBe(true)
    if (oz.ok) {
      expect(oz.unit).toBe('g')
      expect(oz.quantity).toBeCloseTo(85.05, 1)
    }
    const floz = toMetric(2, 'fl_oz')
    expect(floz.ok).toBe(true)
    if (floz.ok) {
      expect(floz.unit).toBe('ml')
      expect(floz.quantity).toBeCloseTo(59.15, 1)
    }
  })

  it('converts household units via the serving anchor (1 cup rice = 160 g)', () => {
    expect(toMetric(1, 'cup', rice)).toEqual({
      ok: true,
      quantity: 160,
      unit: 'g',
    })
    expect(toMetric(0.5, 'cup', rice)).toEqual({
      ok: true,
      quantity: 80,
      unit: 'g',
    })
  })

  it('matches household units case-insensitively', () => {
    expect(toMetric(1, 'Cup', rice).ok).toBe(true)
  })

  it('errors when the food has no matching household serving', () => {
    const res = toMetric(1, 'cup', chicken)
    expect(res).toEqual({ ok: false, error: NO_HOUSEHOLD_SERVING })
  })

  it('errors on household unit without a food', () => {
    expect(toMetric(1, 'cup')).toEqual({ ok: false, error: NO_HOUSEHOLD_SERVING })
  })

  it('errors when anchors are missing or malformed', () => {
    const noCommon = { ...rice, servingCommon: null }
    expect(toMetric(1, 'cup', noCommon).ok).toBe(false)
    const noMetric = { ...rice, servingMetric: null }
    expect(toMetric(1, 'cup', noMetric).ok).toBe(false)
    const zeroCommon = { ...rice, servingCommon: { unit: 'cup', quantity: 0 } }
    expect(toMetric(1, 'cup', zeroCommon).ok).toBe(false)
  })

  it('converts pure units without needing a food anchor (3 oz = 85 g)', () => {
    const noCommon = { ...chicken, servingCommon: null }
    expect(toMetric(3, 'oz', noCommon).ok).toBe(true)
  })
})
