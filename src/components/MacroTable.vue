<script setup lang="ts">
import type { Macros } from '@/types/domain'

defineProps<{
  rows: Array<{ label: string; macros: Macros }>
}>()
</script>

<template>
  <table class="macro-table border striped">
    <thead>
      <tr>
        <th>Day</th>
        <th>kcal</th>
        <th>P (g)</th>
        <th>C (g)</th>
        <th>F (g)</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in rows" :key="row.label">
        <td>{{ row.label }}</td>
        <td>{{ Math.round(row.macros.calories) }}</td>
        <td>{{ Math.round(row.macros.protein) }}</td>
        <td>{{ Math.round(row.macros.carbs) }}</td>
        <td>{{ Math.round(row.macros.fat) }}</td>
      </tr>
    </tbody>
  </table>
</template>
