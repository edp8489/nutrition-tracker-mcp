/**
 * parse.ts — parse an export file with per-item validation (ADR-0027).
 *
 * Envelope-level failures (not JSON, wrong format/version) mark the whole
 * file invalid. Item-level failures reject that item only and are reported
 * per-item so the UI can show exactly what was skipped — never silently drop.
 */

import { z } from 'zod'
import {
  exportLogEntrySchema,
  exportRecipeSchema,
  type ExportLogEntry,
  type ExportRecipe,
} from './envelope'

export interface ParseResult {
  /** false only for envelope-level failures (bad JSON, wrong format/version). */
  ok: boolean
  recipes: ExportRecipe[]
  logEntries: ExportLogEntry[]
  /** Per-item errors, e.g. `recipes[2]: name: required`. */
  errors: string[]
}

function itemError(schema: z.ZodType, item: unknown, label: string): string | null {
  const result = schema.safeParse(item)
  if (result.success) return null
  const messages = result.error.issues.map((i) => i.message).join('; ')
  return `${label}: ${messages}`
}

export function parseExportFile(text: string): ParseResult {
  const empty: ParseResult = { ok: false, recipes: [], logEntries: [], errors: [] }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ...empty, errors: ['file is not valid JSON'] }
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { ...empty, errors: ['file must be a JSON object'] }
  }

  const { format, version, recipes, logEntries } = parsed as Record<string, unknown>
  if (format !== 'nutrition-tracker') {
    return {
      ...empty,
      errors: [`unsupported format "${String(format)}" — expected "nutrition-tracker"`],
    }
  }
  if (version !== 1) {
    return { ...empty, errors: [`unsupported version ${String(version)} — expected 1`] }
  }
  if (!Array.isArray(recipes)) {
    return { ...empty, errors: ['"recipes" must be an array'] }
  }

  const errors: string[] = []
  const validRecipes: ExportRecipe[] = []
  recipes.forEach((recipe, i) => {
    const err = itemError(exportRecipeSchema, recipe, `recipes[${i}]`)
    if (err) errors.push(err)
    else validRecipes.push(recipe as ExportRecipe)
  })

  const validLogEntries: ExportLogEntry[] = []
  if (logEntries !== undefined) {
    if (!Array.isArray(logEntries)) {
      errors.push('"logEntries" must be an array when present')
    } else {
      logEntries.forEach((entry, i) => {
        const err = itemError(exportLogEntrySchema, entry, `logEntries[${i}]`)
        if (err) errors.push(err)
        else validLogEntries.push(entry as ExportLogEntry)
      })
    }
  }

  return { ok: true, recipes: validRecipes, logEntries: validLogEntries, errors }
}
