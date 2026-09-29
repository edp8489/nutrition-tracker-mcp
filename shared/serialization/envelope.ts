/**
 * envelope.ts — export/import envelope types + zod schemas (ADR-0027).
 *
 * One serialization format serves import, LLM attach, server-recipe dirs
 * (ADR-0028), and future one-shot sync (ADR-0029). Types are structurally
 * identical to the client domain types (src/types/domain.ts) so recipes and
 * log entries pass through without mapping — keep the two in sync.
 */

import { z } from 'zod'

// --- schemas -----------------------------------------------------------------

export const exportMacrosSchema = z.object({
  calories: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
})

/** Open nutrient map per ADR-0023: absent key = unmeasured. */
export const exportNutritionSchema = z.record(z.string(), z.number().optional())

export const exportIngredientSchema = z.object({
  foodId: z.string().min(1),
  foodName: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.enum(['g', 'ml']),
})

export const exportRecipeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  ingredients: z.array(exportIngredientSchema).min(1),
  portions: z.number().int().min(1),
  perPortionMacros: exportMacrosSchema,
  perPortionNutrition: exportNutritionSchema.optional(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
})

export const exportFoodRefSchema = z.object({
  foodId: z.string().min(1),
  foodName: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.enum(['g', 'ml']),
})

export const exportRecipeRefSchema = z.object({
  recipeId: z.string().min(1),
  recipeName: z.string().min(1),
  portions: z.number().positive(),
})

export const exportLogEntrySchema = z
  .object({
    id: z.string().min(1),
    timestamp: z.string().min(1),
    kind: z.enum(['food', 'recipe']),
    foodRef: exportFoodRefSchema.optional(),
    recipeRef: exportRecipeRefSchema.optional(),
    snapshotMacros: exportMacrosSchema,
    note: z.string().optional(),
    snapshotNutrition: exportNutritionSchema.optional(),
    createdAt: z.string().min(1),
  })
  .refine(
    (e) =>
      (e.kind === 'food') === Boolean(e.foodRef) &&
      (e.kind === 'recipe') === Boolean(e.recipeRef),
    { message: 'kind must match ref (food → foodRef, recipe → recipeRef)' },
  )

export const exportFileSchema = z.object({
  format: z.literal('nutrition-tracker'),
  version: z.literal(1),
  exportedAt: z.string().min(1),
  recipes: z.array(exportRecipeSchema),
  logEntries: z.array(exportLogEntrySchema).optional(),
})

// --- types -------------------------------------------------------------------

export type ExportMacros = z.infer<typeof exportMacrosSchema>
export type ExportNutrition100g = z.infer<typeof exportNutritionSchema>
export type ExportIngredient = z.infer<typeof exportIngredientSchema>
export type ExportRecipe = z.infer<typeof exportRecipeSchema>
export type ExportFoodLogRef = z.infer<typeof exportFoodRefSchema>
export type ExportRecipeLogRef = z.infer<typeof exportRecipeRefSchema>
export type ExportLogEntry = z.infer<typeof exportLogEntrySchema>
export type ExportFile = z.infer<typeof exportFileSchema>
