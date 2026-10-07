import { describe, expect, it } from 'vitest'
import { createClientHasher } from './identity'

const u = (y: number, mo: number, d: number, h = 0, mi = 0): number =>
  Date.UTC(y, mo - 1, d, h, mi)

describe('createClientHasher', () => {
  it('returns null for missing or empty IPs', () => {
    const hasher = createClientHasher('UTC', () => u(2026, 10, 3, 12))
    expect(hasher.hash(null)).toBeNull()
    expect(hasher.hash('')).toBeNull()
  })

  it('is deterministic within a local day', () => {
    const hasher = createClientHasher('UTC', () => u(2026, 10, 3, 12))
    const a = hasher.hash('203.0.113.7')
    const b = hasher.hash('203.0.113.7')
    expect(a).not.toBeNull()
    expect(a).toBe(b)
  })

  it('separates different clients', () => {
    const hasher = createClientHasher('UTC', () => u(2026, 10, 3, 12))
    expect(hasher.hash('203.0.113.7')).not.toBe(hasher.hash('198.51.100.9'))
  })

  it('re-salts at local midnight (UTC days)', () => {
    let now = u(2026, 10, 3, 23, 59)
    const hasher = createClientHasher('UTC', () => now)
    const before = hasher.hash('203.0.113.7')
    now = u(2026, 10, 4, 0, 1)
    const after = hasher.hash('203.0.113.7')
    expect(after).not.toBeNull()
    expect(after).not.toBe(before)
  })

  it('rotates on the local day boundary, not UTC (New York)', () => {
    let now = u(2026, 10, 3, 23, 59) // 19:59 EDT — still Oct 3 local
    const hasher = createClientHasher('America/New_York', () => now)
    const lateEvening = hasher.hash('203.0.113.7')
    now = u(2026, 10, 4, 0, 1) // 20:01 EDT — still Oct 3 local
    const stillSameDay = hasher.hash('203.0.113.7')
    expect(stillSameDay).toBe(lateEvening)
    now = u(2026, 10, 4, 4, 30) // 00:30 EDT Oct 4 local
    const nextLocalDay = hasher.hash('203.0.113.7')
    expect(nextLocalDay).not.toBe(lateEvening)
  })
})
