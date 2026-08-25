<script setup lang="ts">
import { computed } from 'vue'
import type { LogEntry } from '@/types/domain'

const props = defineProps<{
  entry: LogEntry
}>()

const emit = defineEmits<{
  (e: 'edit', id: string): void
  (e: 'delete', id: string): void
}>()

const hourLabel = computed(() => {
  const d = new Date(props.entry.timestamp)
  return `${String(d.getHours()).padStart(2, '0')}:00`
})

const title = computed(() => {
  if (props.entry.kind === 'recipe' && props.entry.recipeRef) {
    return `${props.entry.recipeRef.recipeName} (${props.entry.recipeRef.portions}×)`
  }
  if (props.entry.kind === 'food' && props.entry.foodRef) {
    return `${props.entry.foodRef.foodName} (${props.entry.foodRef.quantity}${props.entry.foodRef.unit})`
  }
  return 'Unknown'
})

const m = computed(() => props.entry.snapshotMacros)
</script>

<template>
  <tr>
    <td>{{ hourLabel }}</td>
    <td>{{ title }}</td>
    <td class="right-align">{{ Math.round(m.calories) }}</td>
    <td class="right-align">{{ Math.round(m.protein) }}</td>
    <td class="right-align">{{ Math.round(m.carbs) }}</td>
    <td class="right-align">{{ Math.round(m.fat) }}</td>
    <td>
      <button class="chip circle" @click="emit('edit', entry.id)"><i>edit</i></button>
      <button class="chip circle" @click="emit('delete', entry.id)"><i>delete</i></button>
    </td>
  </tr>
</template>
