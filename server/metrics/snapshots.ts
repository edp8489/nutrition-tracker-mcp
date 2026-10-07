/**
 * snapshots.ts — hourly/daily snapshot generation from the metrics store
 * (ADR-0031). Windows are local-clock aligned: hourly [H:00, H:59:30) and
 * daily [00:00, 23:59:30). Idle windows are marked processed but emit no
 * stdout line; completed-but-unreported windows are backfilled on startup,
 * so restarts never lose a snapshot.
 */

import { appendFileSync } from 'node:fs'
import { join } from 'node:path'
import type { MetricsStore, SnapshotKind, WindowAgg } from './store'
import {
  dayEmissionOf,
  dayStartOf,
  formatWindowLabel,
  hourEmissionOf,
  hourStartOf,
  localDayKey,
  nextDayStart,
  nextHourStart,
} from './windowTime'

export interface SnapshotDeps {
  store: MetricsStore
  tz: string
  logDir: string | null
  retentionDays: number | null
  now: () => number
  stdout: (line: string) => void
  onWarn: (message: string) => void
}

const errMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err)

/** Human-readable snapshot for stdout. Hourly: per-endpoint request
 *  counts. Daily: adds unique clients. */
export function formatSnapshotPretty(
  kind: SnapshotKind,
  label: string,
  tz: string,
  agg: WindowAgg,
): string {
  const lines: string[] = [`[METRICS] ${kind} Usage - ${label} ${tz}`]
  lines.push(`    total requests: ${agg.total}`)
  for (const [endpoint, e] of Object.entries(agg.endpoints)) {
    lines.push(`    ${endpoint}: ${e.requests}`)
  }
  if (kind === 'daily') {
    lines.push(`    uniqueClients: ${agg.uniqueClients}`)
  }
  lines.push('======')
  return lines.join('\n')
}

/** JSON line for the log file. Hourly: counts per endpoint only. Daily:
 *  requests/avgMs/errors per endpoint + unique clients + UA buckets.
 *  Nonzero entries only. */
export function formatSnapshotLine(
  kind: SnapshotKind,
  label: string,
  tz: string,
  agg: WindowAgg,
): string {
  if (kind === 'hourly') {
    const requests: Record<string, number> = {}
    for (const [endpoint, e] of Object.entries(agg.endpoints)) {
      requests[endpoint] = e.requests
    }
    return JSON.stringify({
      type: 'usage-hourly',
      window: label,
      timezone: tz,
      requests,
      total: agg.total,
    })
  }
  const endpoints: Record<string, { requests: number; avgMs: number; errors: number }> =
    {}
  for (const [endpoint, e] of Object.entries(agg.endpoints)) {
    endpoints[endpoint] = {
      requests: e.requests,
      avgMs: Math.round((e.totalMs / e.requests) * 10) / 10,
      errors: e.errors,
    }
  }
  return JSON.stringify({
    type: 'usage-daily',
    window: label,
    timezone: tz,
    endpoints,
    uniqueClients: agg.uniqueClients,
    uaBuckets: agg.uaBuckets,
    total: agg.total,
  })
}

function processWindow(
  deps: SnapshotDeps,
  kind: SnapshotKind,
  start: number,
  emission: number,
): void {
  const agg = deps.store.aggregate(start, emission)
  if (agg.total > 0) {
    const label = formatWindowLabel(start, emission, deps.tz)
    deps.stdout(formatSnapshotPretty(kind, label, deps.tz, agg))
    if (deps.logDir !== null) {
      try {
        const line = formatSnapshotLine(kind, label, deps.tz, agg)
        const file = join(deps.logDir, `stdout-${localDayKey(start, deps.tz)}.log`)
        appendFileSync(file, `${line}\n`)
      } catch (err) {
        deps.onWarn(`log file write failed: ${errMessage(err)}`)
      }
    }
  }
  deps.store.markSnapshot(kind, start, emission)
}

function scanHourly(deps: SnapshotDeps, minTs: number | null): void {
  const last = deps.store.lastSnapshotStart('hourly')
  let from: number | null = null
  if (minTs !== null) from = hourStartOf(minTs, deps.tz)
  if (last !== null) {
    const after = nextHourStart(last, deps.tz)
    from = from === null ? after : Math.max(from, after)
  }
  if (from === null) return
  let start = from
  for (let guard = 0; guard < 100_000; guard++) {
    const emission = hourEmissionOf(start, deps.tz)
    if (emission > deps.now()) return
    processWindow(deps, 'hourly', start, emission)
    const next = nextHourStart(start, deps.tz)
    start = next > start ? next : start + 3_600_000
  }
}

function scanDaily(deps: SnapshotDeps, minTs: number | null): void {
  const last = deps.store.lastSnapshotStart('daily')
  let from: number | null = null
  if (minTs !== null) from = dayStartOf(minTs, deps.tz)
  if (last !== null) {
    const after = nextDayStart(last, deps.tz)
    from = from === null ? after : Math.max(from, after)
  }
  if (from === null) return
  let start = from
  let processed = false
  for (let guard = 0; guard < 100_000; guard++) {
    const emission = dayEmissionOf(start, deps.tz)
    if (emission > deps.now()) break
    processWindow(deps, 'daily', start, emission)
    processed = true
    const next = nextDayStart(start, deps.tz)
    start = next > start ? next : start + 86_400_000
  }
  if (processed && deps.retentionDays !== null) {
    deps.store.pruneOlderThan(deps.now() - deps.retentionDays * 86_400_000)
  }
}

/** Emit every completed-but-unreported window (startup backfill + tick). */
export function runDueWindows(deps: SnapshotDeps): void {
  const minTs = deps.store.minRequestTs()
  if (minTs === null && deps.store.lastSnapshotStart('hourly') === null) return
  scanHourly(deps, minTs)
  scanDaily(deps, minTs)
}
