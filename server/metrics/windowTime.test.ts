import { describe, expect, it } from 'vitest'
import {
  dayEmissionOf,
  dayStartOf,
  formatWindowLabel,
  hourEmissionOf,
  hourStartOf,
  localDayKey,
  nextDayStart,
  nextEmissionInstant,
  nextHourStart,
  utcToZonedParts,
  zonedPartsToUtc,
  type ZonedParts,
} from './windowTime'

const NY = 'America/New_York'
const KOL = 'Asia/Kolkata'

/** Months are 1-based, unlike Date.UTC. */
const u = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0, ms = 0): number =>
  Date.UTC(y, mo - 1, d, h, mi, s, ms)

const parts = (
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
  s: number,
): ZonedParts => ({
  year: y,
  month: mo,
  day: d,
  hour: h,
  minute: mi,
  second: s,
  ms: 0,
})

describe('utcToZonedParts / zonedPartsToUtc', () => {
  it('converts UTC instants to wall-clock parts', () => {
    const ny = utcToZonedParts(u(2026, 10, 3, 16, 34, 56), NY)
    expect([ny.hour, ny.minute, ny.second]).toEqual([12, 34, 56])
    expect([ny.year, ny.month, ny.day]).toEqual([2026, 10, 3])

    const kol = utcToZonedParts(u(2026, 10, 3, 6, 30, 0), KOL)
    expect([kol.hour, kol.minute]).toEqual([12, 0])
  })

  it('round-trips wall-clock parts to UTC', () => {
    expect(zonedPartsToUtc(parts(2026, 10, 3, 12, 0, 0), NY)).toBe(
      u(2026, 10, 3, 16, 0, 0),
    )
    expect(zonedPartsToUtc(parts(2026, 10, 3, 12, 0, 0), KOL)).toBe(
      u(2026, 10, 3, 6, 30, 0),
    )
    expect(zonedPartsToUtc(parts(2026, 10, 3, 12, 0, 0), 'UTC')).toBe(
      u(2026, 10, 3, 12, 0, 0),
    )
  })
})

describe('window starts', () => {
  it('hourStartOf floors to the local hour', () => {
    expect(hourStartOf(u(2026, 10, 3, 16, 34, 56), NY)).toBe(u(2026, 10, 3, 16, 0, 0))
    expect(hourStartOf(u(2026, 10, 3, 6, 44, 11), KOL)).toBe(u(2026, 10, 3, 6, 30, 0))
  })

  it('dayStartOf floors to local midnight', () => {
    expect(dayStartOf(u(2026, 10, 3, 16, 34), NY)).toBe(u(2026, 10, 3, 4, 0, 0))
    expect(dayStartOf(u(2026, 10, 4, 1, 0), KOL)).toBe(u(2026, 10, 3, 18, 30, 0))
  })

  it('nextHourStart / nextDayStart advance one local unit', () => {
    expect(nextHourStart(u(2026, 10, 3, 16, 0), NY)).toBe(u(2026, 10, 3, 17, 0, 0))
    expect(nextHourStart(u(2026, 10, 4, 18, 30), KOL)).toBe(u(2026, 10, 4, 19, 30, 0))
    expect(nextDayStart(u(2026, 10, 3, 16, 34), NY)).toBe(u(2026, 10, 4, 4, 0, 0))
    expect(nextDayStart(u(2026, 10, 4, 1, 0), KOL)).toBe(u(2026, 10, 4, 18, 30, 0))
  })

  it('nextDayStart rolls across month and year boundaries', () => {
    expect(nextDayStart(u(2026, 12, 31, 12, 0), 'UTC')).toBe(u(2027, 1, 1, 0, 0, 0))
  })
})

describe('emission instants (H:59:30 local)', () => {
  it('hourEmissionOf is 59:30 into the hour', () => {
    expect(hourEmissionOf(u(2026, 10, 3, 16, 0), NY)).toBe(u(2026, 10, 3, 16, 59, 30))
    expect(hourEmissionOf(u(2026, 10, 3, 12, 0), 'UTC')).toBe(u(2026, 10, 3, 12, 59, 30))
  })

  it('dayEmissionOf is 23:59:30 local', () => {
    expect(dayEmissionOf(u(2026, 10, 3, 4, 0), NY)).toBe(u(2026, 10, 4, 3, 59, 30))
    expect(dayEmissionOf(u(2026, 10, 3, 0, 0), 'UTC')).toBe(u(2026, 10, 3, 23, 59, 30))
  })

  it('nextEmissionInstant picks the next local H:59:30 strictly after now', () => {
    expect(nextEmissionInstant(u(2026, 10, 3, 16, 30), NY)).toBe(
      u(2026, 10, 3, 16, 59, 30),
    )
    expect(nextEmissionInstant(u(2026, 10, 3, 16, 59, 30), NY)).toBe(
      u(2026, 10, 3, 17, 59, 30),
    )
    expect(nextEmissionInstant(u(2026, 10, 3, 16, 59, 30, 1), NY)).toBe(
      u(2026, 10, 3, 17, 59, 30),
    )
    expect(nextEmissionInstant(u(2026, 10, 4, 3, 59, 30, 500), NY)).toBe(
      u(2026, 10, 4, 4, 59, 30),
    )
    expect(nextEmissionInstant(u(2026, 10, 3, 23, 30), KOL)).toBe(
      u(2026, 10, 4, 0, 29, 30),
    )
    expect(nextEmissionInstant(u(2026, 10, 3, 0, 0, 0, 1), 'UTC')).toBe(
      u(2026, 10, 3, 0, 59, 30),
    )
  })
})

describe('labels and day keys', () => {
  it('formatWindowLabel renders start–end with the local offset', () => {
    expect(formatWindowLabel(u(2026, 10, 3, 16, 0), u(2026, 10, 3, 16, 59, 30), NY)).toBe(
      '2026-10-03T12:00:00–12:59:30-04:00',
    )
    expect(formatWindowLabel(u(2026, 10, 3, 6, 30), u(2026, 10, 3, 7, 29, 30), KOL)).toBe(
      '2026-10-03T12:00:00–12:59:30+05:30',
    )
    expect(
      formatWindowLabel(u(2026, 10, 2, 0, 0), u(2026, 10, 2, 23, 59, 30), 'UTC'),
    ).toBe('2026-10-02T00:00:00–23:59:30+00:00')
  })

  it('localDayKey uses the local calendar date', () => {
    expect(localDayKey(u(2026, 10, 3, 16, 0), NY)).toBe('2026-10-03')
    expect(localDayKey(u(2026, 10, 3, 1, 0), NY)).toBe('2026-10-02')
  })
})

describe('DST transitions', () => {
  it('spring forward (2026-03-08 NY): skipped 02:00 advances to the next real boundary', () => {
    const oneAm = u(2026, 3, 8, 6, 0) // 01:00 EST
    expect(hourStartOf(u(2026, 3, 8, 6, 30), NY)).toBe(oneAm)
    expect(nextHourStart(oneAm, NY)).toBe(u(2026, 3, 8, 7, 0)) // 03:00 EDT
  })

  it('fall back (2026-11-01 NY): repeated hour resolves consistently', () => {
    // 06:30Z is the second 01:30 (EST); flooring to wall 01:00 lands on the
    // first occurrence (01:00 EDT) — documented quirk, windows stay coherent.
    expect(hourStartOf(u(2026, 11, 1, 6, 30), NY)).toBe(u(2026, 11, 1, 5, 0))
    const firstOne = u(2026, 11, 1, 5, 0) // 01:00 EDT
    expect(nextHourStart(firstOne, NY)).toBe(u(2026, 11, 1, 6, 0)) // 01:00 EST
  })

  it('nextEmissionInstant stays monotonic across both transitions', () => {
    for (const at of [
      u(2026, 3, 8, 5, 30),
      u(2026, 3, 8, 6, 45),
      u(2026, 11, 1, 4, 30),
      u(2026, 11, 1, 6, 45),
    ]) {
      const next = nextEmissionInstant(at, NY)
      expect(next).toBeGreaterThan(at)
      expect(next).toBeLessThanOrEqual(at + 2 * 3_600_000)
    }
  })
})
