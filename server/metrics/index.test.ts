// @vitest-environment node
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'
import { initMetrics, type Metrics } from './index'

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

const tmpDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'metrics-'))
  dirs.push(dir)
  return dir
}

const request = (headers: Record<string, string>): Request =>
  new Request('http://localhost:3000/mcp', { method: 'POST', headers })

describe('initMetrics', () => {
  it('returns null when disabled', () => {
    expect(initMetrics({})).toBeNull()
    expect(initMetrics({ NUTRITION_ENABLE_LOGGING: '0' })).toBeNull()
  })

  it('propagates config errors (fatal at startup)', () => {
    expect(() => initMetrics({ NUTRITION_ENABLE_LOGGING: 'yes' })).toThrow(
      /NUTRITION_ENABLE_LOGGING/,
    )
    expect(() =>
      initMetrics({
        NUTRITION_ENABLE_LOGGING: '1',
        NUTRITION_METRICS_RETENTION_DAYS: '0',
      }),
    ).toThrow(/0 retention days implies no logging/)
  })

  it('identifies requests without exposing the raw IP', () => {
    const metrics = initMetrics(
      { NUTRITION_ENABLE_LOGGING: '1', NUTRITION_METRICS_DIR: tmpDir() },
      { tz: 'UTC', now: () => Date.UTC(2026, 9, 2, 12) },
    )
    expect(metrics).not.toBeNull()
    const id = metrics!.identify(
      request({ 'user-agent': 'claude-cli/1.0.23 (external, cli)' }),
      () => '203.0.113.7',
    )
    expect(id.clientDayHash).not.toBeNull()
    expect(id.uaBucket).toBe('claude-code')
    const noIp = metrics!.identify(request({}), () => null)
    expect(noIp.clientDayHash).toBeNull()
    expect(noIp.uaBucket).toBe('unknown')
  })

  it('honors X-Forwarded-For only when the proxy is trusted', () => {
    const base = {
      NUTRITION_ENABLE_LOGGING: '1',
      NUTRITION_METRICS_DIR: tmpDir(),
    }
    const direct = initMetrics(base, { tz: 'UTC', now: () => Date.UTC(2026, 9, 2, 12) })
    const xff = direct!.identify(
      request({ 'x-forwarded-for': '198.51.100.9, 10.0.0.1', 'user-agent': 'curl/8' }),
      () => '203.0.113.7',
    )
    const noXff = direct!.identify(
      request({ 'user-agent': 'curl/8' }),
      () => '203.0.113.7',
    )
    expect(xff.clientDayHash).toBe(noXff.clientDayHash)

    const trusting = initMetrics(
      { ...base, NUTRITION_TRUST_PROXY: '1' },
      { tz: 'UTC', now: () => Date.UTC(2026, 9, 2, 12) },
    )
    const trusted = trusting!.identify(
      request({ 'x-forwarded-for': '198.51.100.9, 10.0.0.1', 'user-agent': 'curl/8' }),
      () => '203.0.113.7',
    )
    expect(trusted.clientDayHash).not.toBe(noXff.clientDayHash)
    expect(trusted.uaBucket).toBe('other')
  })

  it('persists recorded rows to metrics.sqlite with rounded durations', () => {
    const dir = tmpDir()
    const metrics: Metrics | null = initMetrics(
      { NUTRITION_ENABLE_LOGGING: '1', NUTRITION_METRICS_DIR: dir },
      { tz: 'UTC', now: () => Date.UTC(2026, 9, 2, 12, 30) },
    )
    const id = metrics!.identify(
      request({ 'user-agent': 'opencode/1.2.3' }),
      () => '203.0.113.7',
    )
    metrics!.record('http:/mcp', 12.34, false, id)
    metrics!.record('mcp:tool:searchIngredient', 41.2, true, id)
    metrics!.stop()

    const db = new DatabaseSync(join(dir, 'metrics.sqlite'))
    const rows = db
      .prepare(
        'SELECT endpoint, duration_ms, is_error, ua_bucket FROM requests ORDER BY endpoint',
      )
      .all() as Array<{
      endpoint: string
      duration_ms: number
      is_error: number
      ua_bucket: string
    }>
    expect(rows).toEqual([
      { endpoint: 'http:/mcp', duration_ms: 12, is_error: 0, ua_bucket: 'opencode' },
      {
        endpoint: 'mcp:tool:searchIngredient',
        duration_ms: 41,
        is_error: 1,
        ua_bucket: 'opencode',
      },
    ])
    db.close()
  })

  it('creates the log dir when configured', () => {
    const dir = tmpDir()
    const logDir = join(dir, 'stdout-logs')
    initMetrics(
      {
        NUTRITION_ENABLE_LOGGING: '1',
        NUTRITION_METRICS_DIR: dir,
        NUTRITION_METRICS_LOG_DIR: logDir,
      },
      { tz: 'UTC' },
    )
    expect(existsSync(logDir)).toBe(true)
  })
})
