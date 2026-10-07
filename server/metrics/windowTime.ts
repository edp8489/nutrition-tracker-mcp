/**
 * windowTime.ts — local-timezone window math for usage snapshots (ADR-0031).
 *
 * Windows align to the container's local clock: hourly [H:00, H:59:30),
 * daily [00:00, 23:59:30). Snapshots emit 30 s before each boundary so every
 * line lands in the log file of the local day it describes; the final 30 s
 * of a window is stored but never snapshot-reported. All storage and clocks
 * stay UTC; conversion happens only at these edges.
 */

export interface ZonedParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  ms: number
}

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
    formatters.set(tz, f)
  }
  return f
}

const pad2 = (n: number): string => String(n).padStart(2, '0')

export function utcToZonedParts(utcMs: number, tz: string): ZonedParts {
  const parts = formatter(tz).formatToParts(new Date(utcMs))
  const map: Record<string, number> = {}
  for (const part of parts) {
    if (part.type !== 'literal') map[part.type] = Number(part.value)
  }
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: map.hour % 24,
    minute: map.minute,
    second: map.second,
    ms: new Date(utcMs).getUTCMilliseconds(),
  }
}

function partsToNaiveUtc(p: ZonedParts): number {
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second, p.ms)
}

/** Offset (ms) such that utc = wallPartsAsUtc - offset. East is negative. */
function offsetAt(utcMs: number, tz: string): number {
  return partsToNaiveUtc(utcToZonedParts(utcMs, tz)) - utcMs
}

function normalizeParts(p: ZonedParts): ZonedParts {
  const d = new Date(partsToNaiveUtc(p))
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
    ms: d.getUTCMilliseconds(),
  }
}

/** Wall-clock parts → UTC instant (two-pass offset resolution for DST). */
export function zonedPartsToUtc(p: ZonedParts, tz: string): number {
  const naive = partsToNaiveUtc(p)
  const first = naive - offsetAt(naive, tz)
  return naive - offsetAt(first, tz)
}

/**
 * Wall-clock parts → the smallest UTC interpretation strictly after
 * `afterMs`. Around DST transitions a wall time can resolve to 0–2 instants;
 * advance functions use this to stay monotonic (e.g. the skipped 02:00 hour
 * resolves to the next real boundary).
 */
function partsToUtcAfter(p: ZonedParts, tz: string, afterMs: number): number {
  const naive = partsToNaiveUtc(p)
  const first = naive - offsetAt(naive, tz)
  const second = naive - offsetAt(first, tz)
  const third = naive - offsetAt(second, tz)
  const candidates = [first, second, third].filter((t) => t > afterMs)
  if (candidates.length > 0) return Math.min(...candidates)
  return afterMs + 3_600_000
}

export function localDayKey(utcMs: number, tz: string): string {
  const p = utcToZonedParts(utcMs, tz)
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`
}

function floorTo(utcMs: number, tz: string, zeroed: Partial<ZonedParts>): number {
  const p = { ...utcToZonedParts(utcMs, tz), ...zeroed } as ZonedParts
  return zonedPartsToUtc(p, tz)
}

export function hourStartOf(utcMs: number, tz: string): number {
  return floorTo(utcMs, tz, { minute: 0, second: 0, ms: 0 })
}

export function dayStartOf(utcMs: number, tz: string): number {
  return floorTo(utcMs, tz, { hour: 0, minute: 0, second: 0, ms: 0 })
}

function advanceTo(
  utcMs: number,
  tz: string,
  step: (p: ZonedParts) => ZonedParts,
): number {
  const next = step(utcToZonedParts(utcMs, tz))
  return partsToUtcAfter(normalizeParts(next), tz, utcMs)
}

export function nextHourStart(utcMs: number, tz: string): number {
  return advanceTo(utcMs, tz, (p) => ({
    ...p,
    hour: p.hour + 1,
    minute: 0,
    second: 0,
    ms: 0,
  }))
}

export function nextDayStart(utcMs: number, tz: string): number {
  return advanceTo(utcMs, tz, (p) => ({
    ...p,
    day: p.day + 1,
    hour: 0,
    minute: 0,
    second: 0,
    ms: 0,
  }))
}

/** Hourly window [H:00, H:59:30): emission instant 30 s before the next hour. */
export function hourEmissionOf(hourStartMs: number, tz: string): number {
  const p = utcToZonedParts(hourStartMs, tz)
  return zonedPartsToUtc({ ...p, minute: 59, second: 30, ms: 0 }, tz)
}

/** Daily window [00:00, 23:59:30): emission instant 30 s before local midnight. */
export function dayEmissionOf(dayStartMs: number, tz: string): number {
  const p = utcToZonedParts(dayStartMs, tz)
  return zonedPartsToUtc({ ...p, hour: 23, minute: 59, second: 30, ms: 0 }, tz)
}

/** Next local H:59:30 strictly after `nowMs` — the scheduler tick instant. */
export function nextEmissionInstant(nowMs: number, tz: string): number {
  const p = utcToZonedParts(nowMs, tz)
  const sameHour = zonedPartsToUtc({ ...p, minute: 59, second: 30, ms: 0 }, tz)
  if (sameHour > nowMs) return sameHour
  return hourEmissionOf(nextHourStart(nowMs, tz), tz)
}

function offsetStringAt(utcMs: number, tz: string): string {
  const totalMinutes = Math.round(offsetAt(utcMs, tz) / 60_000)
  const sign = totalMinutes < 0 ? '-' : '+'
  const abs = Math.abs(totalMinutes)
  return `${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`
}

/**
 * "2026-10-03T12:00:00–12:59:30-04:00" — start (full date+time) – end (time
 * only; windows never cross a local day) with the start's UTC offset.
 */
export function formatWindowLabel(startMs: number, endMs: number, tz: string): string {
  const s = utcToZonedParts(startMs, tz)
  const e = utcToZonedParts(endMs, tz)
  return (
    `${s.year}-${pad2(s.month)}-${pad2(s.day)}` +
    `T${pad2(s.hour)}:${pad2(s.minute)}:${pad2(s.second)}` +
    `–${pad2(e.hour)}:${pad2(e.minute)}:${pad2(e.second)}` +
    offsetStringAt(startMs, tz)
  )
}
