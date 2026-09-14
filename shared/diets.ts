/**
 * diets.ts — server-defined dietary presets (ADR-0020 principle 4).
 *
 * The model never invents criteria. Thresholds are heuristics on the
 * dataset's per-100 g basis, not medical advice. `gluten_free` is a
 * tag-absence preset (best-effort from ingredient_analysis, ADR-0023) —
 * foods without ingredient data cannot be claimed gluten-free.
 */

import type { DietPreset } from './types'

export interface NutrientPresetDef {
  label: string
  nutrient: string
  min?: number
  max?: number
  criteria: string[]
}

export interface TagPresetDef {
  label: string
  tag: string
  criteria: string[]
}

export const DIET_PRESETS: {
  keto: NutrientPresetDef
  low_sodium: NutrientPresetDef
  low_carb: NutrientPresetDef
  high_protein: NutrientPresetDef
  gluten_free: TagPresetDef
} = {
  keto: {
    label: 'keto (low net-carb heuristic)',
    nutrient: 'carbohydrates',
    max: 8,
    criteria: ['carbohydrates ≤ 8 g per 100 g'],
  },
  low_sodium: {
    label: 'low sodium',
    nutrient: 'sodium',
    max: 140,
    criteria: ['sodium ≤ 140 mg per 100 g'],
  },
  low_carb: {
    label: 'low carb',
    nutrient: 'carbohydrates',
    max: 20,
    criteria: ['carbohydrates ≤ 20 g per 100 g'],
  },
  high_protein: {
    label: 'high protein',
    nutrient: 'protein',
    min: 20,
    criteria: ['protein ≥ 20 g per 100 g'],
  },
  gluten_free: {
    label: 'gluten-free (best-effort)',
    tag: 'gluten',
    criteria: [
      'no gluten-tagged ingredients in ingredient_analysis (foods without ingredient data are excluded)',
    ],
  },
}

export const DIET_DISCLAIMER =
  'Dietary presets are server-defined heuristic thresholds on a per-100 g basis, computed from dataset fields — data-grounded statements only, not dietary or medical advice.'

export const GLUTEN_DISCLAIMER =
  'Gluten-free is best-effort: only foods with ingredient_analysis data are included, and "no gluten-tagged ingredients" is a statement about the data, not a certification.'
