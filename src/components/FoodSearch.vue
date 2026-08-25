<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useFoodsStore } from '@/stores/foods'
import { useFavoritesStore } from '@/stores/favorites'
import { useDatasetStore } from '@/stores/dataset'
import type { Food, FoodType } from '@/types/domain'

const props = defineProps<{
  modelValue?: Food | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', food: Food | null): void
  (e: 'select', food: Food): void
}>()

const foods = useFoodsStore()
const favorites = useFavoritesStore()
const dataset = useDatasetStore()

const query = ref('')
const typeFilter = ref<FoodType | ''>('')

let debounce: ReturnType<typeof setTimeout> | null = null

watch(query, (q) => {
  if (debounce) clearTimeout(debounce)
  if (!q.trim()) {
    foods.searchLocal('')
    return
  }
  debounce = setTimeout(async () => {
    await dataset.ensureChunkForQuery(q)
    await foods.searchLocal(q, typeFilter.value || undefined)
  }, 200)
})

watch(typeFilter, () => {
  if (query.value.trim()) {
    foods.searchLocal(query.value, typeFilter.value || undefined)
  }
})

function select(food: Food) {
  emit('update:modelValue', food)
  emit('select', food)
}

const results = computed(() => foods.searchResults)
</script>

<template>
  <div class="food-search">
    <div class="row">
      <div class="field prefix suffix border round">
        <i>search</i>
        <input
          v-model="query"
          type="text"
          placeholder="Search foods by name..."
        />
        <i v-if="query" class="link" @click="query = ''">close</i>
      </div>
    </div>
    <div class="row">
      <label class="chip" :class="{ active: typeFilter === '' }">
        <input
          type="radio"
          name="type"
          value=""
          v-model="typeFilter"
        />
        <span>All</span>
      </label>
      <label class="chip" :class="{ active: typeFilter === 'everyday' }">
        <input type="radio" name="type" value="everyday" v-model="typeFilter" />
        <span>Everyday</span>
      </label>
      <label class="chip" :class="{ active: typeFilter === 'grocery' }">
        <input type="radio" name="type" value="grocery" v-model="typeFilter" />
        <span>Grocery</span>
      </label>
      <label class="chip" :class="{ active: typeFilter === 'prepared' }">
        <input type="radio" name="type" value="prepared" v-model="typeFilter" />
        <span>Prepared</span>
      </label>
      <label class="chip" :class="{ active: typeFilter === 'restaurant' }">
        <input type="radio" name="type" value="restaurant" v-model="typeFilter" />
        <span>Restaurant</span>
      </label>
    </div>
    <div v-if="dataset.loadingChunk" class="row">
      <progress></progress>
      <small>Loading data chunk...</small>
    </div>
    <div class="row">
      <div
        v-for="food in results"
        :key="food.id"
        class="card small padding"
        style="cursor: pointer"
        @click="select(food)"
      >
        <div class="row">
          <div class="col">
            <strong>{{ food.name }}</strong>
            <small class="chip">{{ food.type }}</small>
          </div>
          <div class="col right-align">
            <button
              class="chip circle"
              @click.stop="favorites.toggle(food.id)"
            >
              <i>{{ favorites.isFavorite(food.id) ? 'favorite' : 'favorite_border' }}</i>
            </button>
          </div>
        </div>
        <div class="row macro-table">
          <table>
            <tr>
              <th>kcal</th><th>P</th><th>C</th><th>F</th>
            </tr>
            <tr>
              <td>{{ Math.round(food.nutrition100g.calories) }}</td>
              <td>{{ Math.round(food.nutrition100g.protein) }}</td>
              <td>{{ Math.round(food.nutrition100g.carbohydrates) }}</td>
              <td>{{ Math.round(food.nutrition100g.total_fat) }}</td>
            </tr>
          </table>
          <small>per 100{{ food.servingMetric.unit }}</small>
        </div>
      </div>
    </div>
  </div>
</template>
