/**
 * serialize.ts — build the export envelope and pretty-print it (ADR-0027).
 *
 * `recipes` is length-agnostic (1..N): the same shape serves bulk exports,
 * per-recipe files for the server-recipes dir (ADR-0028), and sync payloads.
 */

import type { ExportFile, ExportLogEntry, ExportRecipe } from './envelope'

export function buildExportFile(
  recipes: ExportRecipe[],
  logEntries?: ExportLogEntry[],
): ExportFile {
  return {
    format: 'nutrition-tracker',
    version: 1,
    exportedAt: new Date().toISOString(),
    recipes,
    ...(logEntries ? { logEntries } : {}),
  }
}

/** Pretty-printed JSON — human-readable is a requirement (ADR-0027). */
export function serializeExportFile(
  recipes: ExportRecipe[],
  logEntries?: ExportLogEntry[],
): string {
  return JSON.stringify(buildExportFile(recipes, logEntries), null, 2)
}
