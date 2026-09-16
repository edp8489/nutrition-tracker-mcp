<script setup lang="ts">
import { computed } from 'vue'
import { CreateOutline, TrashOutline } from '@vicons/ionicons5'
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
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
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
    <td>
      {{ title }}
      <small v-if="entry.note" class="entry-note" :title="entry.note">{{
        entry.note
      }}</small>
    </td>
    <td>{{ Math.round(m.calories) }}</td>
    <td>{{ Math.round(m.protein) }}</td>
    <td>{{ Math.round(m.carbs) }}</td>
    <td>{{ Math.round(m.fat) }}</td>
    <td>
      <n-button quaternary circle size="small" @click="emit('edit', entry.id)">
        <template #icon>
          <n-icon :component="CreateOutline" />
        </template>
      </n-button>
      <n-button quaternary circle size="small" @click="emit('delete', entry.id)">
        <template #icon>
          <n-icon :component="TrashOutline" />
        </template>
      </n-button>
    </td>
  </tr>
</template>
