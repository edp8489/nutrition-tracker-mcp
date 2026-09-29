import { afterAll, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildExportFile } from '../serialization/serialize'
import type { ExportRecipe } from '../serialization/envelope'
import { getServerRecipes } from './getServerRecipes'

function recipe(id: string, name: string): ExportRecipe {
  return {
    id,
    name,
    ingredients: [{ foodId: 'f1', foodName: 'Oats', quantity: 100, unit: 'g' }],
    portions: 1,
    perPortionMacros: { calories: 150, protein: 5, carbs: 27, fat: 3 },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

const dir = mkdtempSync(join(tmpdir(), 'nt-recipes-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('getServerRecipes', () => {
  it('returns empty when the directory does not exist', () => {
    const result = getServerRecipes(join(dir, 'missing'))
    expect(result.recipes).toEqual([])
    expect(result.files).toBe(0)
    expect(result.caveats).toHaveLength(1)
  })

  it('merges per-recipe and multi-recipe files into one array', () => {
    writeFileSync(
      join(dir, 'breakfast-smoothie.json'),
      JSON.stringify(buildExportFile([recipe('a', 'Breakfast Smoothie')])),
    )
    writeFileSync(
      join(dir, 'two.json'),
      JSON.stringify(buildExportFile([recipe('b', 'Toast'), recipe('c', 'Salad')])),
    )
    const result = getServerRecipes(dir)
    expect(result.files).toBe(2)
    expect(result.skipped).toEqual([])
    expect(result.recipes.map((r) => r.name)).toEqual([
      'Breakfast Smoothie',
      'Toast',
      'Salad',
    ])
  })

  it('skips invalid files without failing the directory', () => {
    writeFileSync(join(dir, 'bad.json'), '{not json')
    writeFileSync(join(dir, 'bad-schema.json'), JSON.stringify({ format: 'other' }))
    writeFileSync(join(dir, 'ignored.txt'), 'not a json file')
    const result = getServerRecipes(dir)
    expect(result.files).toBe(4)
    expect(result.skipped).toEqual(['bad-schema.json', 'bad.json'])
    expect(result.recipes).toHaveLength(3)
    expect(result.caveats).toHaveLength(2)
  })

  it('reads the directory fresh per call (new file appears)', () => {
    const before = getServerRecipes(dir)
    writeFileSync(
      join(dir, 'dinner.json'),
      JSON.stringify(buildExportFile([recipe('d', 'Dinner')])),
    )
    const after = getServerRecipes(dir)
    expect(after.files).toBe(before.files + 1)
    expect(after.recipes).toHaveLength(before.recipes.length + 1)
  })

  it('handles an empty directory', () => {
    const empty = join(dir, 'empty')
    mkdirSync(empty)
    const result = getServerRecipes(empty)
    expect(result.recipes).toEqual([])
    expect(result.files).toBe(0)
    expect(result.caveats).toEqual([])
  })
})
