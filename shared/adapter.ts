/**
 * adapter.ts — thin storage seam (ADR-0020, ADR-0022).
 *
 * Tool implementations consume food data through this interface only:
 * bun:sqlite on the server, the spike-chosen mechanism on Android. Keeping
 * the interface minimal is the point.
 */

import type { Food, FoodType } from './types'

export interface SearchOptions {
  type?: FoodType | null
  limit?: number
}

export interface SearchRow {
  food: Food
  /** BM25 rank; lower is better. Everyday boosting happens in the tool layer. */
  score: number
}

export interface NutrientFilterRow {
  food: Food
  /** Value of the filtered nutrient per 100 g. */
  value: number
}

export interface NutrientFilterOptions {
  type?: FoodType | null
  limit?: number
}

export interface TagFilterOptions {
  type?: FoodType | null
  limit?: number
}

export interface FoodRepository {
  getFoodById(id: string): Food | null
  search(query: string, options?: SearchOptions): SearchRow[]
  filterByNutrient(
    nutrient: string,
    min: number | null,
    max: number | null,
    options?: NutrientFilterOptions,
  ): NutrientFilterRow[]
  /**
   * Foods that carry ingredient_analysis data but have no tokens under the
   * given tag (e.g. 'gluten') — the best-effort gluten-free basis (ADR-0023).
   * Foods without ingredient_analysis at all are excluded.
   */
  filterWithoutAnalysisTag(tag: string, options?: TagFilterOptions): Food[]
}
