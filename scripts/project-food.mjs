/**
 * project-food.mjs
 *
 * Shared TSV → projected-row projection for the OpenNutrition dataset.
 * Retains all 13 source columns with no fabricated defaults (ADR-0023):
 * absent, empty, or malformed values project to null; `serving.common` is
 * kept as `servingCommon`; a missing nutrition blob stays null instead of
 * zero-filled macros.
 *
 * TSV column order:
 *   id, name, alternate_names, description, type, source, serving,
 *   nutrition_100g, ean_13, labels, package_size, ingredients,
 *   ingredient_analysis
 *
 * Per ADR-0023. Used by build-subset.mjs and build-sqlite.mjs.
 */

export const TSV_COLUMN_COUNT = 13

export function parseJsonColumn(value) {
  if (value === undefined || value === null || value === '') return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

export function projectRow(cols) {
  const serving = parseJsonColumn(cols[6])
  return {
    id: cols[0],
    name: cols[1],
    altNames: parseJsonColumn(cols[2]),
    description: cols[3] || null,
    type: cols[4] || null,
    source: parseJsonColumn(cols[5]),
    servingMetric: serving?.metric ?? null,
    servingCommon: serving?.common ?? null,
    nutrition100g: parseJsonColumn(cols[7]),
    ean13: cols[8] || null,
    labels: parseJsonColumn(cols[9]),
    packageSize: parseJsonColumn(cols[10]),
    ingredients: cols[11] || null,
    ingredientAnalysis: parseJsonColumn(cols[12]),
  }
}
