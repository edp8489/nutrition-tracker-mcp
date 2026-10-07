/**
 * uaBuckets.ts — coarse client classification (ADR-0031). First substring
 * match wins; missing User-Agent → "unknown", no match → "other". Rules come
 * from NUTRITION_UA_BUCKETS_FILE (JSON array of {match, bucket}); a missing
 * or invalid file falls back to the built-in defaults with one warning.
 * User-Agents are client-controlled, so buckets are advisory, not identity.
 */

import { readFileSync } from 'node:fs'

export interface UaRule {
  match: string
  bucket: string
}

export const DEFAULT_UA_RULES: UaRule[] = [
  // ==========================================
  // 1. Coding Agents, IDEs & Developer Tools
  // (Must precede browser checks due to Electron / embedded runtimes)
  // ==========================================
  { match: 'cursor', bucket: 'cursor' },
  { match: 'copilot', bucket: 'github-copilot' },
  { match: 'claude', bucket: 'claude-code' },
  { match: 'windsurf', bucket: 'windsurf' },
  { match: 'codeium', bucket: 'codeium' },
  { match: 'aider', bucket: 'aider' },
  { match: 'vscode', bucket: 'vscode' },
  { match: 'jetbrains', bucket: 'jetbrains' },
  { match: 'intellij', bucket: 'jetbrains' },
  { match: 'codex', bucket: 'codex' },
  { match: 'opencode', bucket: 'opencode' },
  { match: 'continue', bucket: 'continue' },

  // ==========================================
  // 2. HTTP Clients / Bots / CLI Tools (Optional but helpful)
  // ==========================================
  { match: 'curl', bucket: 'cli-tool' },
  { match: 'postman', bucket: 'api-client' },
  { match: 'python-requests', bucket: 'bot-or-script' },

  // ==========================================
  // 3. Top 5 Web Browsers (Order matters!)
  // ==========================================
  // Edge contains "Chrome" & "Safari"
  { match: 'edg/', bucket: 'browser-edge' },

  // Opera contains "Chrome" & "Safari"
  { match: 'opr/', bucket: 'browser-opera' },

  // Samsung Internet (common on mobile) contains "Chrome" & "Safari"
  { match: 'samsungbrowser', bucket: 'browser-samsung' },

  // Chrome contains "Safari"
  { match: 'chrome', bucket: 'browser-chrome' },

  // Firefox does not contain "Chrome" or "Safari"
  { match: 'firefox', bucket: 'browser-firefox' },

  // Safari matches only after Chrome/Edge/Opera have been eliminated
  { match: 'safari', bucket: 'browser-safari' },

  // ==========================================
  // 4. Generic Browser Fallbacks
  // ==========================================
  { match: 'mozilla', bucket: 'browser-other' },
  { match: 'applewebkit', bucket: 'browser-other' },
  { match: 'gecko', bucket: 'browser-other' },
]

export function loadUaRules(path: string | null): {
  rules: UaRule[]
  warning: string | null
} {
  if (path === null) return { rules: DEFAULT_UA_RULES, warning: null }
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('expected a non-empty JSON array')
    }
    const rules = parsed.map((entry) => {
      const rule = entry as Partial<UaRule>
      if (
        typeof rule?.match !== 'string' ||
        !rule.match.trim() ||
        typeof rule?.bucket !== 'string' ||
        !rule.bucket.trim()
      ) {
        throw new Error('each rule needs non-empty "match" and "bucket" strings')
      }
      return { match: rule.match, bucket: rule.bucket }
    })
    return { rules, warning: null }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    return {
      rules: DEFAULT_UA_RULES,
      warning: `NUTRITION_UA_BUCKETS_FILE "${path}" ignored (${reason}) — using built-in UA bucket rules`,
    }
  }
}

export function classifyUserAgent(
  userAgent: string | null | undefined,
  rules: UaRule[] = DEFAULT_UA_RULES,
  fallback = 'unknown'
): string {
  if (!userAgent) return fallback
  const normalizedUA = userAgent.toLowerCase()
  for (const rule of rules) {
    if (normalizedUA.includes(rule.match.toLowerCase())) {
      return rule.bucket
    }
  }
  return fallback
}
