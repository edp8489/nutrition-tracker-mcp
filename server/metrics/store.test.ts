// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { SqliteMetricsStore } from './store'

const u = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0): number =>
  Date.UTC(y, mo - 1, d, h, mi, s)

describe('SqliteMetricsStore', () => {
  it('aggregates counts, durations, and errors per endpoint', () => {
    const store = new SqliteMetricsStore(':memory:')
    try {
      store.insertRequest({
        ts: u(2026, 10, 2, 12, 0, 10),
        endpoint: 'http:/mcp',
        durationMs: 30,
        isError: false,
        clientDayHash: 'a',
        uaBucket: 'browser',
      })
      store.insertRequest({
        ts: u(2026, 10, 2, 12, 30),
        endpoint: 'http:/mcp',
        durationMs: 40,
        isError: true,
        clientDayHash: 'a',
        uaBucket: 'browser',
      })
      store.insertRequest({
        ts: u(2026, 10, 2, 12, 59, 29),
        endpoint: 'mcp:tool:searchIngredient',
        durationMs: 41,
        isError: false,
        clientDayHash: 'b',
        uaBucket: 'claude-code',
      })

      const agg = store.aggregate(u(2026, 10, 2, 12), u(2026, 10, 2, 13))
      expect(agg.total).toBe(3)
      expect(agg.endpoints['http:/mcp']).toEqual({ requests: 2, totalMs: 70, errors: 1 })
      expect(agg.endpoints['mcp:tool:searchIngredient']).toEqual({
        requests: 1,
        totalMs: 41,
        errors: 0,
      })
    } finally {
      store.close()
    }
  })

  it('treats the window as [from, to)', () => {
    const store = new SqliteMetricsStore(':memory:')
    try {
      store.insertRequest({
        ts: u(2026, 10, 2, 12, 0, 0),
        endpoint: 'http:/mcp',
        durationMs: 1,
        isError: false,
        clientDayHash: null,
        uaBucket: 'unknown',
      })
      store.insertRequest({
        ts: u(2026, 10, 2, 12, 59, 30),
        endpoint: 'http:/mcp',
        durationMs: 2,
        isError: false,
        clientDayHash: null,
        uaBucket: 'unknown',
      })
      store.insertRequest({
        ts: u(2026, 10, 2, 13, 0, 0),
        endpoint: 'http:/mcp',
        durationMs: 4,
        isError: false,
        clientDayHash: null,
        uaBucket: 'unknown',
      })

      const agg = store.aggregate(u(2026, 10, 2, 12, 0, 0), u(2026, 10, 2, 12, 59, 30))
      expect(agg.total).toBe(1)
      expect(agg.endpoints['http:/mcp']?.totalMs).toBe(1)
    } finally {
      store.close()
    }
  })

  it('counts unique client-day hashes, ignoring null', () => {
    const store = new SqliteMetricsStore(':memory:')
    try {
      for (const hash of ['a', 'a', 'b', null]) {
        store.insertRequest({
          ts: u(2026, 10, 2, 12, 30),
          endpoint: 'http:/mcp',
          durationMs: 1,
          isError: false,
          clientDayHash: hash,
          uaBucket: 'unknown',
        })
      }
      expect(store.aggregate(u(2026, 10, 2, 0), u(2026, 10, 3, 0)).uniqueClients).toBe(2)
    } finally {
      store.close()
    }
  })

  it('reports null uniqueClients when no row has a hash', () => {
    const store = new SqliteMetricsStore(':memory:')
    try {
      store.insertRequest({
        ts: u(2026, 10, 2, 12),
        endpoint: 'http:/mcp',
        durationMs: 1,
        isError: false,
        clientDayHash: null,
        uaBucket: 'unknown',
      })
      expect(
        store.aggregate(u(2026, 10, 2, 0), u(2026, 10, 3, 0)).uniqueClients,
      ).toBeNull()
    } finally {
      store.close()
    }
  })

  it('groups UA buckets', () => {
    const store = new SqliteMetricsStore(':memory:')
    try {
      for (const bucket of ['browser', 'browser', 'claude-code', 'unknown']) {
        store.insertRequest({
          ts: u(2026, 10, 2, 12),
          endpoint: 'http:/mcp',
          durationMs: 1,
          isError: false,
          clientDayHash: null,
          uaBucket: bucket,
        })
      }
      expect(store.aggregate(u(2026, 10, 2, 0), u(2026, 10, 3, 0)).uaBuckets).toEqual({
        browser: 2,
        'claude-code': 1,
        unknown: 1,
      })
    } finally {
      store.close()
    }
  })

  it('tracks snapshot markers and min request ts', () => {
    const store = new SqliteMetricsStore(':memory:')
    try {
      expect(store.minRequestTs()).toBeNull()
      expect(store.lastSnapshotStart('hourly')).toBeNull()

      store.insertRequest({
        ts: u(2026, 10, 2, 12, 30),
        endpoint: 'http:/mcp',
        durationMs: 1,
        isError: false,
        clientDayHash: null,
        uaBucket: 'unknown',
      })
      expect(store.minRequestTs()).toBe(u(2026, 10, 2, 12, 30))

      store.markSnapshot('hourly', u(2026, 10, 2, 12), u(2026, 10, 2, 12, 59, 30))
      store.markSnapshot('hourly', u(2026, 10, 2, 13), u(2026, 10, 2, 13, 59, 30))
      expect(store.lastSnapshotStart('hourly')).toBe(u(2026, 10, 2, 13))
      expect(store.lastSnapshotStart('daily')).toBeNull()
    } finally {
      store.close()
    }
  })

  it('prunes old requests and snapshot markers, returning the request count', () => {
    const store = new SqliteMetricsStore(':memory:')
    try {
      store.insertRequest({
        ts: u(2026, 10, 1, 12),
        endpoint: 'http:/mcp',
        durationMs: 1,
        isError: false,
        clientDayHash: null,
        uaBucket: 'unknown',
      })
      store.insertRequest({
        ts: u(2026, 10, 2, 12),
        endpoint: 'http:/mcp',
        durationMs: 1,
        isError: false,
        clientDayHash: null,
        uaBucket: 'unknown',
      })
      store.markSnapshot('hourly', u(2026, 10, 1, 12), u(2026, 10, 1, 12, 59, 30))

      const deleted = store.pruneOlderThan(u(2026, 10, 2, 0))
      expect(deleted).toBe(1)
      expect(store.minRequestTs()).toBe(u(2026, 10, 2, 12))
      expect(store.lastSnapshotStart('hourly')).toBeNull()
    } finally {
      store.close()
    }
  })
})
