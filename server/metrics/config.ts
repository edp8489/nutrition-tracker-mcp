/**
 * config.ts — metrics env parsing + validation (ADR-0031). Logging is opt-in
 * (NUTRITION_ENABLE_LOGGING=1, default 0). Misconfiguration is fatal at
 * startup; environment failures (disk, permissions) fail soft instead.
 */

export interface MetricsConfig {
  metricsDir: string
  logDir: string | null
  trustProxy: boolean
  retentionDays: number | null
  uaBucketsFile: string | null
}

function parseBool(name: string, value: string): boolean {
  const v = value.toLowerCase()
  if (v === '1' || v === 'true') return true
  if (v === '0' || v === 'false') return false
  throw new Error(`${name}: expected 0 or 1, got "${value}"`)
}

export function parseMetricsConfig(
  env: Record<string, string | undefined>,
): MetricsConfig | null {
  const enable = env.NUTRITION_ENABLE_LOGGING
  if (
    enable === undefined ||
    enable === '' ||
    !parseBool('NUTRITION_ENABLE_LOGGING', enable)
  ) {
    return null
  }

  const rawRetention = env.NUTRITION_METRICS_RETENTION_DAYS
  let retentionDays: number | null = null
  if (rawRetention !== undefined && rawRetention !== '' && rawRetention !== '-1') {
    const n = Number(rawRetention)
    if (!Number.isInteger(n) || n < 1) {
      if (n === 0) {
        throw new Error(
          'NUTRITION_METRICS_RETENTION_DAYS: Logging enabled but 0 retention days ' +
            'implies no logging. Either explicitly disable logging or set to 1 or higher.',
        )
      }
      throw new Error(
        `NUTRITION_METRICS_RETENTION_DAYS: expected -1 (keep forever) or an integer >= 1, ` +
          `got "${rawRetention}"`,
      )
    }
    retentionDays = n
  }

  const rawTrust = env.NUTRITION_TRUST_PROXY
  const trustProxy =
    rawTrust === undefined || rawTrust === ''
      ? false
      : parseBool('NUTRITION_TRUST_PROXY', rawTrust)

  return {
    metricsDir: env.NUTRITION_METRICS_DIR?.trim() || 'server/data/metrics',
    logDir: env.NUTRITION_METRICS_LOG_DIR?.trim() || null,
    trustProxy,
    retentionDays,
    uaBucketsFile: env.NUTRITION_UA_BUCKETS_FILE?.trim() || null,
  }
}
