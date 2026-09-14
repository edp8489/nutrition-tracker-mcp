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

export const getIngredientMacrosSchema = {
  id: z.string().min(1).describe('Food id from searchIngredient results'),
  quantity: z
    .number()
    .positive()
    .optional()
    .describe('Amount to normalize macros for, in unit (default: the metric serving)'),
  unit: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Unit for quantity: g, ml, oz, lb, fl_oz, or the food's household serving " +
        '(e.g. cup) — defaults to g',
    ),
}

export const computeRecipeMacrosSchema = {
  ingredients: z
    .array(
      z.object({
        foodId: z.string().min(1).describe('Food id from searchIngredient results'),
        quantity: z.number().positive(),
        unit: z
          .string()
          .min(1)
          .describe("g, ml, oz, lb, fl_oz, or the food's household serving unit"),
      }),
    )
    .min(1)
    .max(50)
    .describe('Recipe ingredients'),
  servings: z
    .number()
    .int()
    .min(1)
    .max(100)
    .describe('Number of portions the recipe yields'),
}

export const filterFoodsSchema = {
  nutrient: z
    .string()
    .regex(/^[a-z0-9_]+$/)
    .optional()
    .describe('Nutrient key per 100 g, e.g. protein, sodium, carbohydrates'),
  min: z.number().optional().describe('Minimum nutrient value per 100 g'),
  max: z.number().optional().describe('Maximum nutrient value per 100 g'),
  dietPreset: z
    .enum(['keto', 'low_sodium', 'low_carb', 'high_protein', 'gluten_free'])
    .optional()
    .describe('Server-defined preset — pass instead of nutrient'),
  category: foodTypeSchema.optional().describe('Filter by category'),
  limit: z.number().int().min(1).max(50).optional().describe('Max results (default 10)'),
}

export const convertUnitsSchema = {
  quantity: z.number().positive(),
  from: z
    .string()
    .min(1)
    .describe('Source unit: g, ml, oz, lb, fl_oz, or a household unit'),
  to: z.string().min(1).describe('Target unit'),
  foodId: z
    .string()
    .min(1)
    .optional()
    .describe('Required when converting to/from a household unit (serving anchor)'),
}
