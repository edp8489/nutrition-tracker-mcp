import { describe, expect, it } from 'vitest'
import { buildExportFile } from './serialize'
import { parseExportFile } from './parse'
import { mergeExport } from './merge'
import type { ExportLogEntry, ExportRecipe } from './envelope'

function recipe(overrides: Partial<ExportRecipe> = {}): ExportRecipe {
  return {
    id: 'r1',
    name: 'Oatmeal',
    ingredients: [{ foodId: 'f1', foodName: 'Oats', quantity: 100, unit: 'g' }],
    portions: 2,
    perPortionMacros: { calories: 150, protein: 5, carbs: 27, fat: 3 },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function foodEntry(overrides: Partial<ExportLogEntry> = {}): ExportLogEntry {
  return {
    id: 'e1',
    timestamp: '2026-01-02T08:00:00Z',
    kind: 'food',
    foodRef: { foodId: 'f1', foodName: 'Oats', quantity: 100, unit: 'g' },
    snapshotMacros: { calories: 150, protein: 5, carbs: 27, fat: 3 },
    createdAt: '2026-01-02T08:00:00Z',
    ...overrides,
  }
}

describe('parseExportFile', () => {
  it('round-trips a serialized file', () => {
    const text = JSON.stringify(buildExportFile([recipe()], [foodEntry()]))
    const parsed = parseExportFile(text)
    expect(parsed.ok).toBe(true)
    expect(parsed.errors).toEqual([])
    expect(parsed.recipes).toHaveLength(1)
    expect(parsed.logEntries).toHaveLength(1)
    expect(parsed.recipes[0].name).toBe('Oatmeal')
  })

  it('rejects non-JSON text', () => {
    const parsed = parseExportFile('not json')
    expect(parsed.ok).toBe(false)
    expect(parsed.errors[0]).toContain('JSON')
  })

  it('rejects the wrong format', () => {
    const parsed = parseExportFile('{"format":"other","version":1,"recipes":[]}')
    expect(parsed.ok).toBe(false)
    expect(parsed.errors[0]).toContain('format')
  })

  it('rejects the wrong version', () => {
    const parsed = parseExportFile(
      '{"format":"nutrition-tracker","version":2,"recipes":[]}',
    )
    expect(parsed.ok).toBe(false)
    expect(parsed.errors[0]).toContain('version')
  })

  it('rejects individual invalid items but keeps valid ones', () => {
    const text = JSON.stringify(
      buildExportFile([recipe(), recipe({ id: 'r2', name: '' })]),
    )
    const parsed = parseExportFile(text)
    expect(parsed.ok).toBe(true)
    expect(parsed.recipes).toHaveLength(1)
    expect(parsed.errors).toHaveLength(1)
    expect(parsed.errors[0]).toContain('recipes[1]')
  })

  it('rejects a log entry whose ref does not match its kind', () => {
    const entry = foodEntry()
    delete entry.foodRef
    const text = JSON.stringify(buildExportFile([], [{ ...entry, kind: 'food' }]))
    const parsed = parseExportFile(text)
    expect(parsed.logEntries).toHaveLength(0)
    expect(parsed.errors[0]).toContain('logEntries[0]')
  })

  it('reports a non-array logEntries field', () => {
    const text =
      '{"format":"nutrition-tracker","version":1,"exportedAt":"2026-01-01T00:00:00Z","recipes":[],"logEntries":{}}'
    const parsed = parseExportFile(text)
    expect(parsed.ok).toBe(true)
    expect(parsed.logEntries).toHaveLength(0)
    expect(parsed.errors[0]).toContain('logEntries')
  })
})

describe('mergeExport', () => {
  it('adds recipes not present in existing', () => {
    const { merged, report } = mergeExport(
      { recipes: [], logEntries: [] },
      { recipes: [recipe()], logEntries: [] },
    )
    expect(merged.recipes).toHaveLength(1)
    expect(report.recipesAdded).toBe(1)
  })

  it('updates a recipe when incoming updatedAt is newer', () => {
    const existing = recipe({ name: 'Old name' })
    const incoming = recipe({ name: 'New name', updatedAt: '2026-02-01T00:00:00Z' })
    const { merged, report } = mergeExport(
      { recipes: [existing], logEntries: [] },
      { recipes: [incoming], logEntries: [] },
    )
    expect(merged.recipes[0].name).toBe('New name')
    expect(report.recipesUpdated).toBe(1)
  })

  it('keeps the existing recipe when incoming updatedAt is older', () => {
    const existing = recipe({ name: 'Newer', updatedAt: '2026-02-01T00:00:00Z' })
    const incoming = recipe({ name: 'Older', updatedAt: '2026-01-01T00:00:00Z' })
    const { merged, report } = mergeExport(
      { recipes: [existing], logEntries: [] },
      { recipes: [incoming], logEntries: [] },
    )
    expect(merged.recipes[0].name).toBe('Newer')
    expect(report.recipesUpdated).toBe(0)
    expect(report.recipesUnchanged).toBe(1)
  })

  it('treats equal updatedAt as unchanged', () => {
    const { report } = mergeExport(
      { recipes: [recipe()], logEntries: [] },
      { recipes: [recipe()], logEntries: [] },
    )
    expect(report.recipesUnchanged).toBe(1)
    expect(report.recipesUpdated).toBe(0)
  })

  it('inserts log entries once and skips the same id (idempotent)', () => {
    const entry = foodEntry()
    const first = mergeExport(
      { recipes: [], logEntries: [] },
      { recipes: [], logEntries: [entry] },
    )
    expect(first.report.logEntriesAdded).toBe(1)
    const second = mergeExport(first.merged, { recipes: [], logEntries: [entry] })
    expect(second.report.logEntriesAdded).toBe(0)
    expect(second.report.logEntriesSkipped).toBe(1)
    expect(second.merged.logEntries).toHaveLength(1)
  })

  it('merges disjoint collections', () => {
    const { merged, report } = mergeExport(
      { recipes: [recipe()], logEntries: [foodEntry()] },
      {
        recipes: [recipe({ id: 'r2', name: 'Toast' })],
        logEntries: [foodEntry({ id: 'e2' })],
      },
    )
    expect(merged.recipes).toHaveLength(2)
    expect(merged.logEntries).toHaveLength(2)
    expect(report.recipesAdded).toBe(1)
    expect(report.logEntriesAdded).toBe(1)
  })
})
