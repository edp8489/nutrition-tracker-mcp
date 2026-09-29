/**
 * getServerRecipes.ts — server-level recipe propagation (ADR-0028).
 *
 * Reads every *.json file in the recipes directory (one file per recipe by
 * convention, e.g. "breakfast-smoothie.json"; any envelope with 1..N recipes
 * is accepted), validates each file against the export envelope, and merges
 * the valid recipes into a single array. Invalid files are skipped and
 * logged — one bad file never fails the whole directory.
 *
 * The directory is read fresh on every call: no cache, no watcher. Newly
 * dropped files appear on the next call without a server restart.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ExportRecipe } from '../serialization/envelope'
import { parseExportFile } from '../serialization/parse'

export interface GetServerRecipesResult {
  recipes: ExportRecipe[]
  /** Number of *.json files found in the directory. */
  files: number
  /** Files skipped due to invalid content (parse or schema failure). */
  skipped: string[]
  caveats: string[]
}

export function getServerRecipes(recipesPath: string): GetServerRecipesResult {
  if (!existsSync(recipesPath)) {
    return {
      recipes: [],
      files: 0,
      skipped: [],
      caveats: [`recipes directory not found: ${recipesPath}`],
    }
  }

  const names = readdirSync(recipesPath)
    .filter((n) => n.endsWith('.json'))
    .sort()

  const recipes: ExportRecipe[] = []
  const skipped: string[] = []
  const caveats: string[] = []

  for (const name of names) {
    try {
      const text = readFileSync(join(recipesPath, name), 'utf8')
      const parsed = parseExportFile(text)
      if (!parsed.ok) {
        skipped.push(name)
        caveats.push(`${name}: ${parsed.errors[0] ?? 'invalid file'}`)
        continue
      }
      if (parsed.errors.length > 0) {
        skipped.push(name)
        caveats.push(`${name}: ${parsed.errors[0]}`)
        continue
      }
      recipes.push(...parsed.recipes)
    } catch (err) {
      skipped.push(name)
      caveats.push(`${name}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return { recipes, files: names.length, skipped, caveats }
}
