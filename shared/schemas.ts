/**
 * schemas.ts — zod input schemas for the v1 tools.
 *
 * The schemas are the tool contracts exposed over MCP (ADR-0025: the
 * searchIngredient contract is fixed in v1). Shared here so Android's
 * in-process callers get the same validation (ADR-0022).
 */

import { z } from 'zod'

export const foodTypeSchema = z
  .enum(['everyday', 'grocery', 'prepared', 'restaurant'])
  .describe('Dataset category')

export const searchIngredientSchema = {
  query: z
    .string()
    .min(1)
    .describe('Food name or alias to search for, e.g. "grilled chicken breast"'),
  type: foodTypeSchema.optional().describe('Filter by category'),
  limit: z.number().int().min(1).max(50).optional().describe('Max results (default 10)'),
}
