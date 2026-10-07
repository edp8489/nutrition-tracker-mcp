/**
 * store.ts — writable metrics store (ADR-0031): one row per request, no PII.
 * Fields: UTC ts, endpoint key (http:/mcp | http:static | http:static:404 |
 * mcp:tool:<name>), duration, error flag, client-day hash, UA bucket.
 * Snapshots are GROUP BY queries over the rows — no derived state, so a
 * restart cannot corrupt a snapshot and history is always re-queryable.
 */

import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export interface RequestRow {
  ts: number
  endpoint: string
  durationMs: number
  isError: boolean
  clientDayHash: string | null
  uaBucket: string
}

export interface EndpointAgg {
  requests: number
  totalMs: number
  errors: number
}

export interface WindowAgg {
  endpoints: Record<string, EndpointAgg>
  uniqueClients: number | null
  uaBuckets: Record<string, number>
  total: number
}

export type SnapshotKind = 'hourly' | 'daily'

export interface MetricsStore {
  insertRequest(row: RequestRow): void
  aggregate(fromMs: number, toMs: number): WindowAgg
  markSnapshot(kind: SnapshotKind, windowStart: number, emittedAt: number): void
  lastSnapshotStart(kind: SnapshotKind): number | null
  minRequestTs(): number | null
  pruneOlderThan(cutoffMs: number): number
  close(): void
}

interface EndpointRow {
  endpoint: string
  requests: number
  total_ms: number
  errors: number
}

interface UniqueRow {
  n: number
  hashed: number | null
}

interface BucketRow {
  ua_bucket: string
  n: number
}

export class SqliteMetricsStore implements MetricsStore {
  private readonly db: DatabaseSync
  private readonly stmtInsert: ReturnType<DatabaseSync['prepare']>
  private readonly stmtEndpoints: ReturnType<DatabaseSync['prepare']>
  private readonly stmtUniques: ReturnType<DatabaseSync['prepare']>
  private readonly stmtBuckets: ReturnType<DatabaseSync['prepare']>
  private readonly stmtMark: ReturnType<DatabaseSync['prepare']>
  private readonly stmtLastSnapshot: ReturnType<DatabaseSync['prepare']>

  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true })
    this.db = new DatabaseSync(path)
    this.db.exec('PRAGMA journal_mode = WAL')
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS requests (
        ts INTEGER NOT NULL,
        endpoint TEXT NOT NULL,
        duration_ms INTEGER NOT NULL,
        is_error INTEGER NOT NULL,
        client_day_hash TEXT,
        ua_bucket TEXT
      )
    `)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS snapshots (
        kind TEXT NOT NULL,
        window_start INTEGER NOT NULL,
        emitted_at INTEGER NOT NULL,
        PRIMARY KEY (kind, window_start)
      )
    `)
    this.db.exec('CREATE INDEX IF NOT EXISTS requests_ts_idx ON requests (ts)')
    this.stmtInsert = this.db.prepare(
      'INSERT INTO requests (ts, endpoint, duration_ms, is_error, client_day_hash, ua_bucket) ' +
        'VALUES (?, ?, ?, ?, ?, ?)',
    )
    this.stmtEndpoints = this.db.prepare(
      'SELECT endpoint, COUNT(*) AS requests, SUM(duration_ms) AS total_ms, ' +
        'SUM(is_error) AS errors FROM requests WHERE ts >= ? AND ts < ? ' +
        'GROUP BY endpoint ORDER BY endpoint',
    )
    this.stmtUniques = this.db.prepare(
      'SELECT COUNT(DISTINCT client_day_hash) AS n, ' +
        'SUM(client_day_hash IS NOT NULL) AS hashed ' +
        'FROM requests WHERE ts >= ? AND ts < ?',
    )
    this.stmtBuckets = this.db.prepare(
      'SELECT ua_bucket, COUNT(*) AS n FROM requests ' +
        'WHERE ts >= ? AND ts < ? AND ua_bucket IS NOT NULL ' +
        'GROUP BY ua_bucket ORDER BY ua_bucket',
    )
    this.stmtMark = this.db.prepare(
      'INSERT OR REPLACE INTO snapshots (kind, window_start, emitted_at) VALUES (?, ?, ?)',
    )
    this.stmtLastSnapshot = this.db.prepare(
      'SELECT MAX(window_start) AS start FROM snapshots WHERE kind = ?',
    )
  }

  insertRequest(row: RequestRow): void {
    this.stmtInsert.run(
      row.ts,
      row.endpoint,
      Math.round(row.durationMs),
      row.isError ? 1 : 0,
      row.clientDayHash,
      row.uaBucket,
    )
  }

  aggregate(fromMs: number, toMs: number): WindowAgg {
    const endpoints: Record<string, EndpointAgg> = {}
    let total = 0
    for (const row of this.stmtEndpoints.all(fromMs, toMs) as unknown as EndpointRow[]) {
      endpoints[row.endpoint] = {
        requests: Number(row.requests),
        totalMs: Number(row.total_ms),
        errors: Number(row.errors),
      }
      total += Number(row.requests)
    }
    const unique = (this.stmtUniques.get(fromMs, toMs) ??
      null) as unknown as UniqueRow | null
    const uniqueClients =
      unique !== null && unique.hashed !== null && Number(unique.hashed) > 0
        ? Number(unique.n)
        : null
    const uaBuckets: Record<string, number> = {}
    for (const row of this.stmtBuckets.all(fromMs, toMs) as unknown as BucketRow[]) {
      uaBuckets[row.ua_bucket] = Number(row.n)
    }
    return { endpoints, uniqueClients, uaBuckets, total }
  }

  markSnapshot(kind: SnapshotKind, windowStart: number, emittedAt: number): void {
    this.stmtMark.run(kind, windowStart, emittedAt)
  }

  lastSnapshotStart(kind: SnapshotKind): number | null {
    const row = (this.stmtLastSnapshot.get(kind) ?? null) as unknown as {
      start: number | bigint | null
    } | null
    return row !== null && row.start !== null ? Number(row.start) : null
  }

  minRequestTs(): number | null {
    const row = (this.db.prepare('SELECT MIN(ts) AS m FROM requests').get() ??
      null) as unknown as { m: number | bigint | null } | null
    return row !== null && row.m !== null ? Number(row.m) : null
  }

  pruneOlderThan(cutoffMs: number): number {
    const requests = Number(
      this.db.prepare('DELETE FROM requests WHERE ts < ?').run(cutoffMs).changes,
    )
    this.db.prepare('DELETE FROM snapshots WHERE window_start < ?').run(cutoffMs)
    return requests
  }

  close(): void {
    this.db.close()
  }
}
