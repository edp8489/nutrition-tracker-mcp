/**
 * db.ts — bun:sqlite adapter over the full OpenNutrition SQLite DB
 * (ADR-0020: storage is consumed through a thin adapter).
 *
 * FTS5 BM25 column weights, highest → lowest (must match
 * scripts/build-sqlite.mjs): name 10.0, altNames 5.0, labels 3.0,
 * description 1.0, ingredients 0.5. Everyday boosting happens in the tool
 * layer (shared/tools/searchIngredient.ts), not here.
 */

import { Database } from 'bun:sqlite'
import type {
  Food,
  FoodRepository,
  NutrientFilterOptions,
  NutrientFilterRow,
  SearchOptions,
  SearchRow,
  TagFilterOptions,
} from '@nutrition-tracker/shared'

interface FoodRow {
  id: string
  name: string
  altNames: string | null
  description: string | null
  type: string | null
  source: string | null
  servingMetric: string | null
  servingCommon: string | null
  nutrition100g: string | null
  ean13: string | null
  labels: string | null
  packageSize: string | null
  ingredients: string | null
  ingredientAnalysis: string | null
}

function parseJson<T>(value: string | null): T | null {
  if (value === null || value === undefined || value === '') return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function rowToFood(row: FoodRow): Food {
  return {
    id: row.id,
    name: row.name,
    altNames: parseJson<string[]>(row.altNames),
    description: row.description,
    type: (row.type as Food['type']) ?? null,
    source: parseJson<unknown>(row.source),
    servingMetric: parseJson<Food['servingMetric']>(row.servingMetric),
    servingCommon: parseJson<Food['servingCommon']>(row.servingCommon),
    nutrition100g: parseJson<Food['nutrition100g']>(row.nutrition100g),
    ean13: row.ean13,
    labels: parseJson<string[]>(row.labels),
    packageSize: row.packageSize,
    ingredients: row.ingredients,
    ingredientAnalysis: parseJson<Food['ingredientAnalysis']>(row.ingredientAnalysis),
  }
}

/**
 * Sanitize a free-text query into an FTS5 MATCH expression: each token is
 * double-quoted (implicit AND), neutralizing quotes and other MATCH syntax.
 */
export function ftsMatchExpression(query: string): string {
  return query
    .split(/\s+/)
    .map((t) => t.replace(/"/g, '').trim())
    .filter((t) => t.length > 0)
    .map((t) => `"${t}"`)
    .join(' ')
}

const BM25_WEIGHTS = 'bm25(foods_fts, 10.0, 5.0, 3.0, 1.0, 0.5)'

export class BunSqliteRepository implements FoodRepository {
  readonly #db: Database

  constructor(dbPath: string) {
    this.#db = new Database(dbPath, { readonly: true })
  }

  getFoodById(id: string): Food | null {
    const row = this.#db
      .query<FoodRow, [string]>('SELECT * FROM foods WHERE id = ?')
      .get(id)
    return row ? rowToFood(row) : null
  }

  search(query: string, options: SearchOptions = {}): SearchRow[] {
    const limit = options.limit ?? 50
    const match = ftsMatchExpression(query)
    if (match === '') return []
    const sql = `
      SELECT foods.*, ${BM25_WEIGHTS} AS score
      FROM foods_fts
      JOIN foods ON foods.rowid = foods_fts.rowid
      WHERE foods_fts MATCH ?
      ${options.type ? 'AND foods.type = ?' : ''}
      ORDER BY score
      LIMIT ?
    `
    const params: Array<string | number> = options.type
      ? [match, options.type, limit]
      : [match, limit]
    return this.#db
      .query<FoodRow & { score: number }, Array<string | number>>(sql)
      .all(...params)
      .map((row) => ({ food: rowToFood(row), score: row.score }))
  }

  filterByNutrient(
    nutrient: string,
    min: number | null,
    max: number | null,
    options: NutrientFilterOptions = {},
  ): NutrientFilterRow[] {
    if (!/^[a-z0-9_]+$/.test(nutrient)) return []
    const path = `$.${nutrient}`
    const limit = options.limit ?? 50
    const conditions = [
      'foods.nutrition100g IS NOT NULL',
      `json_type(foods.nutrition100g, '${path}') IN ('integer', 'real')`,
    ]
    const params: Array<string | number> = []
    if (min !== null) {
      conditions.push(`CAST(json_extract(foods.nutrition100g, '${path}') AS REAL) >= ?`)
      params.push(min)
    }
    if (max !== null) {
      conditions.push(`CAST(json_extract(foods.nutrition100g, '${path}') AS REAL) <= ?`)
      params.push(max)
    }
    if (options.type) {
      conditions.push('foods.type = ?')
      params.push(options.type)
    }
    params.push(limit)
    const sql = `
      SELECT foods.*, CAST(json_extract(foods.nutrition100g, '${path}') AS REAL) AS value
      FROM foods
      WHERE ${conditions.join(' AND ')}
      LIMIT ?
    `
    return this.#db
      .query<FoodRow & { value: number }, Array<string | number>>(sql)
      .all(...params)
      .map((row) => ({ food: rowToFood(row), value: row.value }))
  }

  filterWithoutAnalysisTag(tag: string, options: TagFilterOptions = {}): Food[] {
    if (!/^[a-z0-9_]+$/.test(tag)) return []
    const limit = options.limit ?? 50
    const sql = `
      SELECT foods.*
      FROM foods
      WHERE foods.ingredientAnalysis IS NOT NULL
        AND COALESCE(json_array_length(json_extract(foods.ingredientAnalysis, '$.${tag}')), 0) = 0
        ${options.type ? 'AND foods.type = ?' : ''}
      LIMIT ?
    `
    const params: Array<string | number> = []
    if (options.type) params.push(options.type)
    params.push(limit)
    return this.#db
      .query<FoodRow, Array<string | number>>(sql)
      .all(...params)
      .map(rowToFood)
  }

  close(): void {
    this.#db.close()
  }
}
