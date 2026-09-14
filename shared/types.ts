/**
 * types.ts — shared domain + v1 MCP tool contracts.
 *
 * Food is the projected OpenNutrition row per ADR-0023: all 13 source TSV
 * columns retained, camelCase matching scripts/project-food.mjs output.
 * Absent/empty values are null — never fabricated zeros.
 *
 * Tool contracts are fixed in v1 (ADR-0025) so phase-2 additions (embeddings)
 * require no client changes.
 */

export type FoodType = 'everyday' | 'grocery' | 'prepared' | 'restaurant'

export interface ServingMetric {
  unit: 'g' | 'ml'
  quantity: number
}

/** Household serving anchor, e.g. { unit: 'cup', quantity: 1 } (ADR-0024). */
export interface ServingCommon {
  unit: string
  quantity: number
}

/** ~90 nutrient sub-fields per 100 g. Absent key = unmeasured (ADR-0023). */
export interface Nutrition100g {
  calories?: number | null
  protein?: number | null
  total_fat?: number | null
  saturated_fats?: number | null
  monounsaturated_fats?: number | null
  polyunsaturated_fats?: number | null
  trans_fats?: number | null
  carbohydrates?: number | null
  dietary_fiber?: number | null
  soluble_fiber?: number | null
  insoluble_fiber?: number | null
  total_sugars?: number | null
  added_sugars?: number | null
  sodium?: number | null
  ethyl_alcohol?: number | null
  [key: string]: number | null | undefined
}

/** ingredient_analysis blob: tag → matched ingredient tokens (ADR-0023). */
export type IngredientAnalysis = Record<string, string[]>

export interface Food {
  id: string
  name: string
  altNames: string[] | null
  description: string | null
  type: FoodType | null
  source: unknown | null
  servingMetric: ServingMetric | null
  servingCommon: ServingCommon | null
  nutrition100g: Nutrition100g | null
  ean13: string | null
  labels: string[] | null
  packageSize: string | null
  ingredients: string | null
  ingredientAnalysis: IngredientAnalysis | null
}

/** The four MVP macronutrients (glossary: Macros). */
export interface Macros {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export type MetricUnit = 'g' | 'ml'
export type PureUnit = 'g' | 'ml' | 'oz' | 'lb' | 'fl_oz'

export interface Attribution {
  dataset: string
  url: string
  contributors: string
  contributorsUrl: string
  license: string
  notice: string
}

/** A nutrient value served with measured-value semantics (ADR-0023). */
export interface ServedNutrient {
  key: string
  value: number | null
  measured: boolean
  caveat?: string
}

// --- searchIngredient ------------------------------------------------------

export interface SearchIngredientParams {
  query: string
  type?: FoodType
  limit?: number
}

export interface SearchHit {
  id: string
  name: string
  type: FoodType | null
  servingMetric: ServingMetric | null
  servingCommon: ServingCommon | null
  perServingMacros: Macros | null
  /** BM25 rank; lower is better. */
  score: number
}

export interface SearchIngredientResult {
  hits: SearchHit[]
  attribution: Attribution
}

// --- getIngredientMacros ---------------------------------------------------

export interface GetIngredientMacrosParams {
  id: string
  /** Amount to normalize for, in `unit` (defaults to the food's metric serving). */
  quantity?: number
  /** Pure or household unit (ADR-0024); defaults to the food's servingMetric unit. */
  unit?: string
}

export interface GetIngredientMacrosResult {
  id: string
  name: string | null
  per100g: ServedNutrient[]
  requested: { quantity: number; unit: MetricUnit; macros: Macros | null } | null
  perServing: { quantity: number; unit: MetricUnit; macros: Macros | null } | null
  caveats: string[]
  attribution: Attribution
}

// --- computeRecipeMacros --------------------------------------------------

export interface RecipeIngredientInput {
  foodId: string
  quantity: number
  unit: string
}

export interface ComputeRecipeMacrosParams {
  ingredients: RecipeIngredientInput[]
  servings: number
}

export interface RecipeIngredientMacros {
  foodId: string
  foodName: string | null
  quantity: number
  unit: MetricUnit
  macros: Macros | null
  note?: string
}

export interface ComputeRecipeMacrosResult {
  servings: number
  totalMacros: Macros | null
  perServingMacros: Macros | null
  ingredients: RecipeIngredientMacros[]
  caveats: string[]
  attribution: Attribution
}

// --- filterFoods -----------------------------------------------------------

export type DietPreset = 'keto' | 'low_sodium' | 'low_carb' | 'high_protein'

export interface FilterFoodsParams {
  nutrient?: string
  min?: number
  max?: number
  dietPreset?: DietPreset
  category?: FoodType
  limit?: number
}

export interface FilteredFood {
  id: string
  name: string
  type: FoodType | null
  value: number | null
}

export interface FilterFoodsResult {
  filter: string
  criteria: string[]
  foods: FilteredFood[]
  caveats: string[]
  attribution: Attribution
}

// --- convertUnits ----------------------------------------------------------

export interface ConvertUnitsParams {
  quantity: number
  from: string
  to: string
  /** Required when converting to/from a household unit (serving anchor, ADR-0024). */
  foodId?: string
}

export interface ConvertUnitsResult {
  quantity: number | null
  unit: string | null
  note?: string
  error?: string
  attribution: Attribution
}
