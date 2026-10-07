/**
 * identity.ts — client-day hash (ADR-0031): HMAC-SHA256 of the client IP with
 * a per-local-day ephemeral salt. The salt lives only in memory and is
 * discarded on rotation and on restart, so stored hashes cannot be linked
 * across days or recomputed against candidate IPs. A mid-day restart
 * re-salts and may double-count an active client — accepted: privacy trumps
 * exact unique counts.
 */

import { createHmac, randomBytes } from 'node:crypto'
import { localDayKey } from './windowTime'

export interface ClientHasher {
  hash(ip: string | null): string | null
}

export function createClientHasher(tz: string, now: () => number): ClientHasher {
  let salt = randomBytes(32)
  let day = localDayKey(now(), tz)

  return {
    hash(ip) {
      if (ip === null || ip === '') return null
      const today = localDayKey(now(), tz)
      if (today !== day) {
        salt = randomBytes(32)
        day = today
      }
      return createHmac('sha256', salt).update(ip).digest('hex')
    },
  }
}
