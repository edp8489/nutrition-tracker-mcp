import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { classifyUserAgent, DEFAULT_UA_RULES, loadUaRules } from './uaBuckets'

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

const tmpFile = (content: string): string => {
  const dir = mkdtempSync(join(tmpdir(), 'ua-buckets-'))
  dirs.push(dir)
  const file = join(dir, 'buckets.json')
  writeFileSync(file, content)
  return file
}

describe('classifyUserAgent (default rules)', () => {
  it('maps known clients to their buckets', () => {
    expect(
      classifyUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130',
        DEFAULT_UA_RULES,
      ),
    ).toBe('browser')
    expect(classifyUserAgent('claude-cli/1.0.23 (external, cli)', DEFAULT_UA_RULES)).toBe(
      'claude-code',
    )
    expect(classifyUserAgent('codex_cli_rs/0.5.0', DEFAULT_UA_RULES)).toBe('codex')
    expect(classifyUserAgent('opencode/1.2.3', DEFAULT_UA_RULES)).toBe('opencode')
  })

  it('matches case-insensitively', () => {
    expect(classifyUserAgent('Claude-Code/2.0', DEFAULT_UA_RULES)).toBe('claude-code')
  })

  it('first matching rule wins', () => {
    const rules = [
      { match: 'claude', bucket: 'first' },
      { match: 'claude-cli', bucket: 'second' },
    ]
    expect(classifyUserAgent('claude-cli/1.0', rules)).toBe('first')
  })

  it('falls back to other/unknown', () => {
    expect(classifyUserAgent('curl/8.0', DEFAULT_UA_RULES)).toBe('other')
    expect(classifyUserAgent(null, DEFAULT_UA_RULES)).toBe('unknown')
    expect(classifyUserAgent('', DEFAULT_UA_RULES)).toBe('unknown')
  })
})

describe('loadUaRules', () => {
  it('returns defaults when no file is configured', () => {
    const { rules, warning } = loadUaRules(null)
    expect(rules).toEqual(DEFAULT_UA_RULES)
    expect(warning).toBeNull()
  })

  it('replaces defaults with a valid rules file', () => {
    const file = tmpFile(JSON.stringify([{ match: 'vim', bucket: 'vim' }]))
    const { rules, warning } = loadUaRules(file)
    expect(rules).toEqual([{ match: 'vim', bucket: 'vim' }])
    expect(warning).toBeNull()
  })

  it('falls back to defaults with a warning on invalid JSON', () => {
    const { rules, warning } = loadUaRules(tmpFile('{not json'))
    expect(rules).toEqual(DEFAULT_UA_RULES)
    expect(warning).toMatch(/NUTRITION_UA_BUCKETS_FILE/)
  })

  it('falls back to defaults on wrong shape or empty array', () => {
    expect(loadUaRules(tmpFile('{"match": "x"}')).warning).toMatch(/ignored/)
    expect(loadUaRules(tmpFile('[]')).warning).toMatch(/ignored/)
    expect(loadUaRules(tmpFile('[{"match": "", "bucket": "b"}]')).warning).toMatch(
      /ignored/,
    )
    expect(loadUaRules(tmpFile('[{"match": "a"}]')).warning).toMatch(/ignored/)
  })

  it('warns for a missing file', () => {
    const { rules, warning } = loadUaRules(join(tmpdir(), 'does-not-exist.json'))
    expect(rules).toEqual(DEFAULT_UA_RULES)
    expect(warning).toMatch(/ignored/)
  })

  it('readable file content matches what was written', () => {
    const file = tmpFile('[{"match":"vim","bucket":"vim"}]')
    expect(readFileSync(file, 'utf8')).toBe('[{"match":"vim","bucket":"vim"}]')
  })
})
