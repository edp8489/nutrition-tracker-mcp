/**
 * merge.ts — the single conflict-resolution point (ADR-0027).
 *
 * Recipes merge by id, last-write-wins on `updatedAt` (equal → unchanged).
 * Log entries are immutable events: insert-if-absent, same id → skip.
 * v1.x one-shot sync (ADR-0029) reuses this exact function as its convergence
 * step — continuous sync is permanently rejected there.
 */

import type { ExportLogEntry, ExportRecipe } from './envelope'

export interface ExportCollection {
  recipes: ExportRecipe[]
  logEntries: ExportLogEntry[]
}

export interface MergeReport {
  recipesAdded: number
  recipesUpdated: number
  recipesUnchanged: number
  logEntriesAdded: number
  logEntriesSkipped: number
}

export function mergeExport(
  existing: ExportCollection,
  incoming: ExportCollection,
): { merged: ExportCollection; report: MergeReport } {
  const report: MergeReport = {
    recipesAdded: 0,
    recipesUpdated: 0,
    recipesUnchanged: 0,
    logEntriesAdded: 0,
    logEntriesSkipped: 0,
  }

  // Recipes: by id, last-write-wins on updatedAt.
  const recipesById = new Map(existing.recipes.map((r) => [r.id, r]))
  for (const recipe of incoming.recipes) {
    const current = recipesById.get(recipe.id)
    if (!current) {
      recipesById.set(recipe.id, recipe)
      report.recipesAdded++
    } else if (recipe.updatedAt > current.updatedAt) {
      recipesById.set(recipe.id, recipe)
      report.recipesUpdated++
    } else {
      report.recipesUnchanged++
    }
  }

  // Log entries: immutable events, insert-if-absent.
  const entryIds = new Set(existing.logEntries.map((e) => e.id))
  const logEntries = [...existing.logEntries]
  for (const entry of incoming.logEntries) {
    if (entryIds.has(entry.id)) {
      report.logEntriesSkipped++
    } else {
      logEntries.push(entry)
      entryIds.add(entry.id)
      report.logEntriesAdded++
    }
  }

  return {
    merged: { recipes: [...recipesById.values()], logEntries },
    report,
  }
}
