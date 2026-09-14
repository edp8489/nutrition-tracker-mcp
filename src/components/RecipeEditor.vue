<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { TrashOutline } from '@vicons/ionicons5'
import { useRecipesStore } from '@/stores/recipes'
import { useFoodsStore } from '@/stores/foods'
import { foodMacrosForQuantity, sumMacros, divideMacros } from '@/utils/macros'
import type { Ingredient, Food, Unit, Macros } from '@/types/domain'
import FoodSearch from './FoodSearch.vue'

const props = defineProps<{
  recipeId?: string | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const recipes = useRecipesStore()
const foodsStore = useFoodsStore()

const name = ref('')
const portions = ref(1)
const ingredients = ref<Ingredient[]>([])

const unitOptions: Array<{ label: Unit; value: Unit }> = [
  { label: 'g', value: 'g' },
  { label: 'ml', value: 'ml' },
]

watch(
  () => props.recipeId,
  async (id) => {
    if (!id) return
    const r = await recipes.recipes.find((x) => x.id === id)
    if (r) {
      name.value = r.name
      portions.value = r.portions
      ingredients.value = [...r.ingredients]
    }
  },
  { immediate: true },
)

const computedMacros = computed<Macros>(() => {
  const list: Macros[] = []
  for (const ing of ingredients.value) {
    const food = foodsStore.searchResults.find((f) => f.id === ing.foodId)
    if (food) {
      list.push(foodMacrosForQuantity(food.nutrition100g, ing.quantity))
    }
  }
  return divideMacros(sumMacros(list), portions.value || 1)
})

function addIngredient(food: Food) {
  ingredients.value.push({
    foodId: food.id,
    foodName: food.name,
    quantity: food.servingMetric.quantity,
    unit: food.servingMetric.unit,
  })
}

function removeIngredient(idx: number) {
  ingredients.value.splice(idx, 1)
}

function onModalShowChange(show: boolean) {
  if (!show) emit('close')
}

async function save() {
  if (!name.value.trim() || ingredients.value.length === 0) return
  if (props.recipeId) {
    await recipes.updateRecipe(
      props.recipeId,
      name.value,
      ingredients.value,
      portions.value || 1,
    )
  } else {
    await recipes.createRecipe(name.value, ingredients.value, portions.value || 1)
  }
  emit('close')
}
</script>

<template>
  <n-modal
    :show="true"
    preset="card"
    :title="recipeId ? 'Edit Recipe' : 'New Recipe'"
    style="width: 90%; max-width: 640px"
    @update:show="onModalShowChange"
  >
    <n-input v-model:value="name" placeholder="Recipe name" />

    <div style="margin-top: 8px">
      <n-input-number
        :value="portions"
        :min="1"
        :step="1"
        @update:value="(v: number | null) => (portions = v ?? 1)"
      >
        <template #prefix>Portions</template>
      </n-input-number>
    </div>

    <h6>Ingredients</h6>
    <FoodSearch @select="addIngredient" />

    <n-table :bordered="true" class="macro-table" style="margin-top: 8px">
      <thead>
        <tr>
          <th>Ingredient</th><th>Qty</th><th>Unit</th><th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(ing, idx) in ingredients" :key="idx">
          <td>{{ ing.foodName }}</td>
          <td>
            <n-input-number
              :value="ing.quantity"
              :min="0"
              :step="1"
              size="small"
              style="width: 110px"
              @update:value="(v: number | null) => (ing.quantity = v ?? 0)"
            />
          </td>
          <td>
            <n-select
              :value="ing.unit"
              :options="unitOptions"
              size="small"
              style="width: 90px"
              @update:value="(v: Unit) => (ing.unit = v)"
            />
          </td>
          <td>
            <n-button quaternary circle size="small" @click="removeIngredient(idx)">
              <template #icon>
                <n-icon :component="TrashOutline" />
              </template>
            </n-button>
          </td>
        </tr>
      </tbody>
    </n-table>

    <div class="row" style="margin-top: 8px">
      <div class="col">
        <h6>Per portion</h6>
        <p>
          {{ Math.round(computedMacros.calories) }} kcal ·
          {{ Math.round(computedMacros.protein) }}g P ·
          {{ Math.round(computedMacros.carbs) }}g C ·
          {{ Math.round(computedMacros.fat) }}g F
        </p>
      </div>
    </div>

    <template #footer>
      <div class="row" style="justify-content: flex-end">
        <n-button @click="emit('close')">Cancel</n-button>
        <n-button type="primary" @click="save">Save</n-button>
      </div>
    </template>
  </n-modal>
</template>
