export type FoodType = 'everyday' | 'grocery' | 'prepared' | 'restaurant'
export type Unit = 'g' | 'ml'

export interface ServingMetric {
  unit: Unit
  quantity: number
}

export interface Macros {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export interface Nutrition100g {
  calories: number
  protein: number
  total_fat: number
  carbohydrates: number
  dietary_fiber?: number
  total_sugars?: number
  ethyl_alcohol?: number
  [key: string]: number | undefined
}

export interface Food {
  id: string
  name: string
  altNames: string[]
  type: FoodType
  servingMetric: ServingMetric
  nutrition100g: Nutrition100g
  ean13?: string
  labels?: string[]
}

export interface Ingredient {
  foodId: string
  foodName: string
  quantity: number
  unit: Unit
}

export interface Recipe {
  id: string
  name: string
  ingredients: Ingredient[]
  portions: number
  perPortionMacros: Macros
  createdAt: string
  updatedAt: string
}

export type LogKind = 'food' | 'recipe'

export interface FoodLogRef {
  foodId: string
  foodName: string
  quantity: number
  unit: Unit
}

export interface RecipeLogRef {
  recipeId: string
  recipeName: string
  portions: number
}

export interface LogEntry {
  id: string
  timestamp: string
  kind: LogKind
  foodRef?: FoodLogRef
  recipeRef?: RecipeLogRef
  snapshotMacros: Macros
  createdAt: string
}

export interface Favorite {
  foodId: string
  addedAt: string
}

export interface Recent {
  foodId: string
  lastUsedAt: string
}

export interface ChunkManifestEntry {
  chunkFile: string
  firstChars: string
  foodCount: number
  sizeBytes: number
}

export interface ChunkManifest {
  version: string
  generatedAt: string
  chunks: ChunkManifestEntry[]
}
