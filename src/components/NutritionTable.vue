<script setup lang="ts">
import { computed } from 'vue'
import type { ServedNutrient } from '@nutrition-tracker/shared/types'

const props = defineProps<{
  rows: ServedNutrient[]
}>()

/** Core macros first, the rest in source order (mirrors shared/nutrition.ts). */
const CORE_FIRST = ['calories', 'protein', 'total_fat', 'carbohydrates']

const ordered = computed<ServedNutrient[]>(() => {
  const rows = props.rows
  return [
    ...rows.filter((r) => CORE_FIRST.includes(r.key)),
    ...rows.filter((r) => !CORE_FIRST.includes(r.key)),
  ]
})

const UNITS: Record<string, string> = {
  calories: 'kcal',
  protein: 'g',
  total_fat: 'g',
  saturated_fats: 'g',
  monounsaturated_fats: 'g',
  polyunsaturated_fats: 'g',
  trans_fats: 'g',
  carbohydrates: 'g',
  dietary_fiber: 'g',
  soluble_fiber: 'g',
  insoluble_fiber: 'g',
  total_sugars: 'g',
  added_sugars: 'g',
  sugar_alcohols: 'g',
  ethyl_alcohol: 'g',
  water: 'g',
  sodium: 'mg',
  potassium: 'mg',
  calcium: 'mg',
  iron: 'mg',
  zinc: 'mg',
  magnesium: 'mg',
  phosphorus: 'mg',
  cholesterol: 'mg',
  caffeine: 'mg',
}

const LABELS: Record<string, string> = {
  calories: 'Calories',
  protein: 'Protein',
  total_fat: 'Total fat',
  saturated_fats: 'Saturated fat',
  monounsaturated_fats: 'Monounsaturated fat',
  polyunsaturated_fats: 'Polyunsaturated fat',
  trans_fats: 'Trans fat',
  carbohydrates: 'Carbohydrates',
  dietary_fiber: 'Dietary fiber',
  soluble_fiber: 'Soluble fiber',
  insoluble_fiber: 'Insoluble fiber',
  total_sugars: 'Total sugars',
  added_sugars: 'Added sugars',
  sugar_alcohols: 'Sugar alcohols',
  ethyl_alcohol: 'Alcohol',
  water: 'Water',
  sodium: 'Sodium',
  potassium: 'Potassium',
  calcium: 'Calcium',
  iron: 'Iron',
  zinc: 'Zinc',
  magnesium: 'Magnesium',
  phosphorus: 'Phosphorus',
  cholesterol: 'Cholesterol',
  caffeine: 'Caffeine',
}

function label(key: string): string {
  return LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function unit(key: string): string {
  return UNITS[key] ?? ''
}

function amount(row: ServedNutrient): string {
  const value = row.value ?? 0
  const rounded = Math.round(value * 100) / 100
  const u = unit(row.key)
  return u ? `${rounded} ${u}` : `${rounded}`
}
</script>

<template>
  <p v-if="ordered.length === 0" class="center-align">
    No measured nutrient data reported.
  </p>
  <n-table v-else striped :bordered="true" class="macro-table nutrition-table">
    <thead>
      <tr>
        <th>Nutrient</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in ordered" :key="row.key">
        <td>{{ label(row.key) }}</td>
        <td>
          <span v-if="row.measured">{{ amount(row) }}</span>
          <span v-else title="Not reported in the source data">—</span>
        </td>
      </tr>
    </tbody>
  </n-table>
</template>
