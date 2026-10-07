import { describe, expect, it } from 'vitest'
import { parseMetricsConfig } from './config'

describe('parseMetricsConfig', () => {
  it('is disabled by default and for 0/false', () => {
    expect(parseMetricsConfig({})).toBeNull()
    expect(parseMetricsConfig({ NUTRITION_ENABLE_LOGGING: '0' })).toBeNull()
    expect(parseMetricsConfig({ NUTRITION_ENABLE_LOGGING: 'false' })).toBeNull()
    expect(parseMetricsConfig({ NUTRITION_ENABLE_LOGGING: '' })).toBeNull()
  })

  it('rejects garbage enable values', () => {
    expect(() => parseMetricsConfig({ NUTRITION_ENABLE_LOGGING: 'yes' })).toThrow(
      /NUTRITION_ENABLE_LOGGING/,
    )
  })

  it('returns defaults when enabled', () => {
    expect(parseMetricsConfig({ NUTRITION_ENABLE_LOGGING: '1' })).toEqual({
      metricsDir: 'server/data/metrics',
      logDir: null,
      trustProxy: false,
      retentionDays: null,
      uaBucketsFile: null,
    })
    expect(parseMetricsConfig({ NUTRITION_ENABLE_LOGGING: 'true' })).not.toBeNull()
  })

  it('passes through configured values', () => {
    expect(
      parseMetricsConfig({
        NUTRITION_ENABLE_LOGGING: '1',
        NUTRITION_METRICS_DIR: '/data/metrics',
        NUTRITION_METRICS_LOG_DIR: '/data/logs',
        NUTRITION_TRUST_PROXY: '1',
        NUTRITION_METRICS_RETENTION_DAYS: '30',
        NUTRITION_UA_BUCKETS_FILE: '/etc/ua.json',
      }),
    ).toEqual({
      metricsDir: '/data/metrics',
      logDir: '/data/logs',
      trustProxy: true,
      retentionDays: 30,
      uaBucketsFile: '/etc/ua.json',
    })
  })

  it('treats whitespace-only values as unset', () => {
    expect(
      parseMetricsConfig({
        NUTRITION_ENABLE_LOGGING: '1',
        NUTRITION_METRICS_DIR: '  ',
        NUTRITION_METRICS_LOG_DIR: ' ',
        NUTRITION_UA_BUCKETS_FILE: '',
      }),
    ).toEqual({
      metricsDir: 'server/data/metrics',
      logDir: null,
      trustProxy: false,
      retentionDays: null,
      uaBucketsFile: null,
    })
  })

  it('retention: -1 or unset means keep forever', () => {
    expect(
      parseMetricsConfig({
        NUTRITION_ENABLE_LOGGING: '1',
        NUTRITION_METRICS_RETENTION_DAYS: '-1',
      })?.retentionDays,
    ).toBeNull()
    expect(
      parseMetricsConfig({ NUTRITION_ENABLE_LOGGING: '1' })?.retentionDays,
    ).toBeNull()
    expect(
      parseMetricsConfig({
        NUTRITION_ENABLE_LOGGING: '1',
        NUTRITION_METRICS_RETENTION_DAYS: '5',
      })?.retentionDays,
    ).toBe(5)
  })

  it('retention 0 while enabled is fatal with the explicit message', () => {
    expect(() =>
      parseMetricsConfig({
        NUTRITION_ENABLE_LOGGING: '1',
        NUTRITION_METRICS_RETENTION_DAYS: '0',
      }),
    ).toThrow(
      'NUTRITION_METRICS_RETENTION_DAYS: Logging enabled but 0 retention days ' +
        'implies no logging. Either explicitly disable logging or set to 1 or higher.',
    )
  })

  it('retention 0 while disabled is ignored', () => {
    expect(
      parseMetricsConfig({
        NUTRITION_ENABLE_LOGGING: '0',
        NUTRITION_METRICS_RETENTION_DAYS: '0',
      }),
    ).toBeNull()
  })

  it('rejects non-integer or negative retention values', () => {
    for (const bad of ['abc', '1.5', '-2', '']) {
      if (bad === '') continue
      expect(() =>
        parseMetricsConfig({
          NUTRITION_ENABLE_LOGGING: '1',
          NUTRITION_METRICS_RETENTION_DAYS: bad,
        }),
      ).toThrow(/NUTRITION_METRICS_RETENTION_DAYS/)
    }
  })

  it('parses trust proxy strictly', () => {
    expect(
      parseMetricsConfig({ NUTRITION_ENABLE_LOGGING: '1', NUTRITION_TRUST_PROXY: 'true' })
        ?.trustProxy,
    ).toBe(true)
    expect(
      parseMetricsConfig({ NUTRITION_ENABLE_LOGGING: '1', NUTRITION_TRUST_PROXY: '0' })
        ?.trustProxy,
    ).toBe(false)
    expect(() =>
      parseMetricsConfig({
        NUTRITION_ENABLE_LOGGING: '1',
        NUTRITION_TRUST_PROXY: 'maybe',
      }),
    ).toThrow(/NUTRITION_TRUST_PROXY/)
  })
})
