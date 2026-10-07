/**
 * metrics — opt-in usage + performance metrics (ADR-0031).
 *
 * Deep module: wiring touches only identify/record/start/stop. Raw client
 * IP and User-Agent cross the interface exactly once (identify) and are
 * immediately reduced to a client-day hash + coarse UA bucket before
 * storage; request payloads and tool arguments are never recorded.
 * Recording fails soft — a metrics error must never take down serving.
 */

import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseMetricsConfig } from './config'
import { createClientHasher } from './identity'
import { runDueWindows, type SnapshotDeps } from './snapshots'
import { SqliteMetricsStore } from './store'
import { classifyUserAgent, loadUaRules } from './uaBuckets'
import { nextEmissionInstant } from './windowTime'

export interface RequestIdentity {
  clientDayHash: string | null
  uaBucket: string
}

export interface Metrics {
  readonly summary: string
  identify(req: Request, requestIP: (req: Request) => string | null): RequestIdentity
  record(
    endpoint: string,
    durationMs: number,
    isError: boolean,
    identity: RequestIdentity,
  ): void
  start(): void
  stop(): void
}

export interface MetricsOptions {
  now?: () => number
  tz?: string
}

const errMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err)

export function initMetrics(
  env: Record<string, string | undefined>,
  opts: MetricsOptions = {},
): Metrics | null {
  const config = parseMetricsConfig(env)
  if (config === null) return null

  const tz = opts.tz ?? (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
  const now = opts.now ?? Date.now

  const { rules, warning } = loadUaRules(config.uaBucketsFile)
  if (warning !== null) console.error(`nutrition-tracker metrics: ${warning}`)

  let store: SqliteMetricsStore
  try {
    mkdirSync(config.metricsDir, { recursive: true })
    if (config.logDir !== null) mkdirSync(config.logDir, { recursive: true })
    store = new SqliteMetricsStore(join(config.metricsDir, 'metrics.sqlite'))
  } catch (err) {
    console.error(
      `nutrition-tracker metrics: disabled — cannot open metrics store: ${errMessage(err)}`,
    )
    return null
  }

  const hasher = createClientHasher(tz, now)
  let healthy = true
  let timer: ReturnType<typeof setTimeout> | null = null
  let stopped = false
  const warn = (message: string): void => {
    console.error(`nutrition-tracker metrics: ${message}`)
  }
  const fail = (err: unknown): void => {
    if (healthy) {
      healthy = false
      warn(`disabled due to store error: ${errMessage(err)}`)
    }
  }

  const deps: SnapshotDeps = {
    store,
    tz,
    logDir: config.logDir,
    retentionDays: config.retentionDays,
    now,
    stdout: (line) => console.log(line),
    onWarn: warn,
  }
  const runDue = (): void => {
    if (!healthy) return
    try {
      runDueWindows(deps)
    } catch (err) {
      fail(err)
    }
  }
  const schedule = (): void => {
    const delay = Math.max(0, nextEmissionInstant(now(), tz) - now())
    timer = setTimeout(() => {
      timer = null
      runDue()
      if (!stopped && healthy) schedule()
    }, delay)
  }

  return {
    summary:
      `nutrition-tracker metrics: enabled — store ` +
      `${join(config.metricsDir, 'metrics.sqlite')}, tz ${tz}, ` +
      `snapshots at :59:30 local (ADR-0031)`,
    identify(req, requestIP) {
      let ip: string | null = null
      if (config.trustProxy) {
        const xff = req.headers.get('x-forwarded-for')
        const first = xff?.split(',')[0]?.trim()
        if (first) ip = first
      }
      if (ip === null) ip = requestIP(req)
      return {
        clientDayHash: hasher.hash(ip),
        uaBucket: classifyUserAgent(req.headers.get('user-agent'), rules),
      }
    },
    record(endpoint, durationMs, isError, identity) {
      if (!healthy) return
      try {
        store.insertRequest({
          ts: now(),
          endpoint,
          durationMs,
          isError,
          clientDayHash: identity.clientDayHash,
          uaBucket: identity.uaBucket,
        })
      } catch (err) {
        fail(err)
      }
    },
    start() {
      if (timer !== null || stopped) return
      runDue()
      if (!stopped && healthy) schedule()
    },
    stop() {
      stopped = true
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
      try {
        store.close()
      } catch (err) {
        warn(`store close failed: ${errMessage(err)}`)
      }
    },
  }
}
