// @vitest-environment node
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { runDueWindows, type SnapshotDeps } from './snapshots'
import { SqliteMetricsStore, type MetricsStore } from './store'

const u = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0): number =>
  Date.UTC(y, mo - 1, d, h, mi, s)

interface Harness {
  store: MetricsStore
  lines: string[]
  warnings: string[]
  logDir: string | null
  makeDeps: (now: number, retentionDays?: number | null) => SnapshotDeps
}

function makeHarness(logDir: string | null = null): Harness {
  const store = new SqliteMetricsStore(':memory:')
  const lines: string[] = []
  const warnings: string[] = []
  return {
    store,
    lines,
    warnings,
    logDir,
    makeDeps: (now, retentionDays = null) => ({
      store,
      tz: 'UTC',
      logDir,
      retentionDays,
      now: () => now,
      stdout: (line) => lines.push(line),
      onWarn: (message) => warnings.push(message),
    }),
  }
}

const harnesses: Harness[] = []
afterEach(() => {
  for (const h of harnesses.splice(0)) {
    h.store.close()
    if (h.logDir !== null) rmSync(h.logDir, { recursive: true, force: true })
  }
})

function track(h: Harness): Harness {
  harnesses.push(h)
  return h
}

function insert(
  h: Harness,
  ts: number,
  endpoint: string,
  durationMs: number,
  isError = false,
  clientDayHash: string | null = null,
  uaBucket = 'unknown',
): void {
  h.store.insertRequest({ ts, endpoint, durationMs, isError, clientDayHash, uaBucket })
}

describe('runDueWindows (UTC)', () => {
  it('emits an hourly line for a completed window and marks it', () => {
    const h = track(makeHarness())
    insert(h, u(2026, 10, 2, 12, 0, 10), 'http:/mcp', 30, false, 'a', 'browser')
    insert(h, u(2026, 10, 2, 12, 30), 'http:static', 40, false, 'a', 'browser')
    insert(
      h,
      u(2026, 10, 2, 12, 59, 29),
      'mcp:tool:searchIngredient',
      41,
      false,
      'b',
      'claude-code',
    )

    runDueWindows(h.makeDeps(u(2026, 10, 2, 13, 30)))

    expect(h.lines).toHaveLength(1)
    const line = JSON.parse(h.lines[0])
    expect(line.type).toBe('usage-hourly')
    expect(line.window).toBe('2026-10-02T12:00:00–12:59:30+00:00')
    expect(line.timezone).toBe('UTC')
    expect(line.requests).toEqual({
      'http:/mcp': 1,
      'http:static': 1,
      'mcp:tool:searchIngredient': 1,
    })
    expect(line.total).toBe(3)
    expect(h.store.lastSnapshotStart('hourly')).toBe(u(2026, 10, 2, 12))
  })

  it('excludes the final 30 s tail from the window (never snapshot-reported)', () => {
    const h = track(makeHarness())
    insert(h, u(2026, 10, 2, 12, 30), 'http:/mcp', 10, false, 'a', 'browser')
    insert(h, u(2026, 10, 2, 12, 59, 45), 'http:/mcp', 10, false, 'a', 'browser')

    runDueWindows(h.makeDeps(u(2026, 10, 2, 13, 30)))

    expect(h.lines).toHaveLength(1)
    expect(JSON.parse(h.lines[0]).total).toBe(1)
  })

  it('backfills missed windows (restart) and skips empty hours silently', () => {
    const h = track(makeHarness())
    insert(h, u(2026, 10, 2, 10, 15), 'http:/mcp', 5, false, 'a', 'browser')
    insert(h, u(2026, 10, 2, 12, 30), 'http:/mcp', 7, false, 'a', 'browser')

    runDueWindows(h.makeDeps(u(2026, 10, 2, 13, 30)))

    const hours = h.lines.map((l) => JSON.parse(l).window)
    expect(hours).toEqual([
      '2026-10-02T10:00:00–10:59:30+00:00',
      '2026-10-02T12:00:00–12:59:30+00:00',
    ])

    h.lines.length = 0
    runDueWindows(h.makeDeps(u(2026, 10, 2, 14, 30)))
    expect(h.lines).toHaveLength(0)
    expect(h.store.lastSnapshotStart('hourly')).toBe(u(2026, 10, 2, 13))
  })

  it('does not re-emit already-marked windows', () => {
    const h = track(makeHarness())
    insert(h, u(2026, 10, 2, 12, 30), 'http:/mcp', 5, false, 'a', 'browser')

    runDueWindows(h.makeDeps(u(2026, 10, 2, 13, 30)))
    runDueWindows(h.makeDeps(u(2026, 10, 2, 18, 30)))

    expect(h.lines).toHaveLength(1)
  })

  it('emits a detailed daily line at 23:59:30 with uniques and buckets', () => {
    const h = track(makeHarness())
    insert(h, u(2026, 10, 2, 9, 0), 'http:/mcp', 20, false, 'a', 'browser')
    insert(h, u(2026, 10, 2, 9, 5), 'http:/mcp', 25, false, 'a', 'browser')
    insert(
      h,
      u(2026, 10, 2, 10, 0),
      'mcp:tool:searchIngredient',
      30,
      false,
      'a',
      'claude-code',
    )
    insert(h, u(2026, 10, 2, 15, 0), 'http:static:404', 5, false, 'b', 'browser')
    insert(h, u(2026, 10, 2, 20, 0), 'mcp:tool:filterFoods', 100, true, 'b', 'codex')

    runDueWindows(h.makeDeps(u(2026, 10, 3, 1, 30)))

    const daily = h.lines.map((l) => JSON.parse(l)).find((l) => l.type === 'usage-daily')
    expect(daily).toBeDefined()
    expect(daily.window).toBe('2026-10-02T00:00:00–23:59:30+00:00')
    expect(daily.endpoints['http:/mcp']).toEqual({ requests: 2, avgMs: 22.5, errors: 0 })
    expect(daily.endpoints['mcp:tool:searchIngredient']).toEqual({
      requests: 1,
      avgMs: 30,
      errors: 0,
    })
    expect(daily.endpoints['mcp:tool:filterFoods']).toEqual({
      requests: 1,
      avgMs: 100,
      errors: 1,
    })
    expect(daily.endpoints['http:static:404']).toEqual({
      requests: 1,
      avgMs: 5,
      errors: 0,
    })
    expect(daily.uniqueClients).toBe(2)
    expect(daily.uaBuckets).toEqual({ browser: 3, 'claude-code': 1, codex: 1 })
    expect(daily.total).toBe(5)
  })

  it('rounds avgMs to one decimal', () => {
    const h = track(makeHarness())
    insert(h, u(2026, 10, 2, 12, 0, 0), 'http:/mcp', 23, false, null)
    insert(h, u(2026, 10, 2, 12, 0, 1), 'http:/mcp', 24, false, null)
    insert(h, u(2026, 10, 2, 12, 0, 2), 'http:/mcp', 23.94, false, null)

    runDueWindows(h.makeDeps(u(2026, 10, 3, 1, 30)))
    const daily = h.lines.map((l) => JSON.parse(l)).find((l) => l.type === 'usage-daily')
    // insertRequest rounds durations: 23.94 → 24, so (23+24+24)/3 = 23.7
    expect(daily.endpoints['http:/mcp'].avgMs).toBe(23.7)
  })

  it('writes snapshot lines into per-local-day log files', () => {
    const logDir = mkdtempSync(join(tmpdir(), 'metrics-logs-'))
    const h = track(makeHarness(logDir))
    insert(h, u(2026, 10, 2, 12, 30), 'http:/mcp', 5, false, 'a', 'browser')
    insert(h, u(2026, 10, 3, 0, 10), 'http:/mcp', 5, false, 'a', 'browser')

    runDueWindows(h.makeDeps(u(2026, 10, 3, 1, 30)))

    expect(readdirSync(logDir).sort()).toEqual([
      'stdout-2026-10-02.log',
      'stdout-2026-10-03.log',
    ])
    const day2 = readFileSync(join(logDir, 'stdout-2026-10-02.log'), 'utf8')
      .trim()
      .split('\n')
    const day3 = readFileSync(join(logDir, 'stdout-2026-10-03.log'), 'utf8')
      .trim()
      .split('\n')
    // Day 2: its hourly line + the daily line for Oct 2
    expect(day2).toHaveLength(2)
    expect(JSON.parse(day2[0]).window).toBe('2026-10-02T12:00:00–12:59:30+00:00')
    expect(JSON.parse(day2[1]).type).toBe('usage-daily')
    // Day 3: only the 00:00–00:59:30 hourly line
    expect(day3).toHaveLength(1)
    expect(JSON.parse(day3[0]).window).toBe('2026-10-03T00:00:00–00:59:30+00:00')
  })

  it('prunes rows past the retention window after the daily snapshot', () => {
    const h = track(makeHarness())
    insert(h, u(2026, 10, 2, 12, 30), 'http:/mcp', 5, false, 'a', 'browser')
    insert(h, u(2026, 10, 3, 12, 30), 'http:/mcp', 5, false, 'a', 'browser')

    runDueWindows(h.makeDeps(u(2026, 10, 4, 1, 30), 1))
    // Retention 1 day from now (Oct 4 01:30Z) → everything before Oct 3 01:30Z is gone
    expect(h.store.minRequestTs()).toBe(u(2026, 10, 3, 12, 30))
  })

  it('keeps rows forever when retention is null', () => {
    const h = track(makeHarness())
    insert(h, u(2026, 9, 1, 12, 30), 'http:/mcp', 5, false, 'a', 'browser')
    runDueWindows(h.makeDeps(u(2026, 10, 4, 1, 30)))
    expect(h.store.minRequestTs()).toBe(u(2026, 9, 1, 12, 30))
  })
})

describe('runDueWindows (local timezone)', () => {
  const localTzDeps = (
    store: MetricsStore,
    now: number,
    lines: string[],
  ): SnapshotDeps => ({
    store,
    tz: 'America/New_York',
    logDir: null,
    retentionDays: null,
    now: () => now,
    stdout: (line) => lines.push(line),
    onWarn: () => {},
  })

  it('aligns hourly windows to local hours', () => {
    const h = track(makeHarness())
    const lines: string[] = []
    insert(h, u(2026, 10, 3, 16, 10), 'http:/mcp', 5, false, null, 'browser')
    runDueWindows(localTzDeps(h.store, u(2026, 10, 3, 20, 30), lines)) // 16:30 EDT
    expect(lines).toHaveLength(1)
    expect(JSON.parse(lines[0]).window).toBe('2026-10-03T12:00:00–12:59:30-04:00')
    expect(JSON.parse(lines[0]).timezone).toBe('America/New_York')
  })

  it('does not emit a daily line before local 23:59:30', () => {
    const h = track(makeHarness())
    const lines: string[] = []
    insert(h, u(2026, 10, 3, 16, 10), 'http:/mcp', 5, false, null, 'browser')
    runDueWindows(localTzDeps(h.store, u(2026, 10, 4, 3, 0), lines)) // 23:00 EDT
    expect(lines).toHaveLength(1)
    expect(lines.filter((l) => JSON.parse(l).type === 'usage-daily')).toHaveLength(0)
  })
})
