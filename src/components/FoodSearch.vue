<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { Heart, HeartOutline, SearchOutline } from '@vicons/ionicons5'
import { useFoodsStore } from '@/stores/foods'
import { useFavoritesStore } from '@/stores/favorites'
import type { Food, FoodType } from '@/types/domain'

defineProps<{
  modelValue?: Food | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', food: Food | null): void
  (e: 'select', food: Food): void
}>()

const foods = useFoodsStore()
const favorites = useFavoritesStore()

const query = ref('')
const typeFilter = ref<FoodType | ''>('')

const typeOptions: Array<{ label: string; value: FoodType | '' }> = [
  { label: 'All', value: '' },
  { label: 'Everyday', value: 'everyday' },
  { label: 'Grocery', value: 'grocery' },
  { label: 'Prepared', value: 'prepared' },
  { label: 'Restaurant', value: 'restaurant' },
]

let debounce: ReturnType<typeof setTimeout> | null = null

watch(query, (q) => {
  if (debounce) clearTimeout(debounce)
  if (!q.trim()) {
    void foods.search('')
    return
  }
  debounce = setTimeout(() => {
    void foods.search(q, typeFilter.value || undefined)
  }, 200)
})

watch(typeFilter, () => {
  if (query.value.trim()) {
    void foods.search(query.value, typeFilter.value || undefined)
  }
})

function select(food: Food) {
  emit('update:modelValue', food)
  emit('select', food)
}

function servingLabel(food: Food): string {
  if (food.servingCommon) {
    return `${food.servingCommon.quantity} ${food.servingCommon.unit}`
  }
  return `${food.servingMetric.quantity} ${food.servingMetric.unit}`
}

const results = computed(() => foods.searchResults)
</script>

<template>
  <div class="food-search">
    <n-input v-model:value="query" placeholder="Search foods by name..." clearable>
      <template #prefix>
        <n-icon :component="SearchOutline" />
      </template>
    </n-input>

    <div class="row" style="margin-top: 8px">
      <n-tag
        v-for="t in typeOptions"
        :key="t.value"
        checkable
        round
        :checked="typeFilter === t.value"
        @update:checked="typeFilter = t.value"
      >
        {{ t.label }}
      </n-tag>
    </div>

    <div v-if="foods.searching" class="row" style="margin-top: 8px">
      <n-spin :size="14" />
      <small>Searching…</small>
    </div>
    <p v-else-if="foods.searchError" class="error" style="margin-top: 8px">
      {{ foods.searchError }}
    </p>

    <n-card
      v-for="food in results"
      :key="food.id"
      size="small"
      style="cursor: pointer; margin-top: 8px"
      @click="select(food)"
    >
      <div class="row">
        <div class="col">
          <strong>{{ food.name }}</strong>
          <n-tag v-if="food.type" size="small">{{ food.type }}</n-tag>
        </div>
        <div class="col right-align">
          <n-button
            quaternary
            circle
            size="small"
            @click.stop="favorites.toggle(food.id)"
          >
            <template #icon>
              <n-icon :component="favorites.isFavorite(food.id) ? Heart : HeartOutline" />
            </template>
          </n-button>
        </div>
      </div>
      <div class="row" style="justify-content: space-between">
        <table v-if="food.perServingMacros" class="macro-table">
          <tbody>
            <tr>
              <th>kcal</th>
              <th>P</th>
              <th>C</th>
              <th>F</th>
            </tr>
            <tr>
              <td>{{ Math.round(food.perServingMacros.calories) }}</td>
              <td>{{ Math.round(food.perServingMacros.protein) }}</td>
              <td>{{ Math.round(food.perServingMacros.carbs) }}</td>
              <td>{{ Math.round(food.perServingMacros.fat) }}</td>
            </tr>
          </tbody>
        </table>
        <small>per serving · {{ servingLabel(food) }}</small>
      </div>
    </n-card>
  </div>
</template>
