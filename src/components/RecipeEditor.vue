<script setup lang="ts">
import { ref, watch, computed } from 'vue'
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

async function save() {
  if (!name.value.trim() || ingredients.value.length === 0) return
  if (props.recipeId) {
    await recipes.updateRecipe(
      props.recipeId,
      name.value,
      ingredients.value,
      portions.value,
    )
  } else {
    await recipes.createRecipe(name.value, ingredients.value, portions.value)
  }
  emit('close')
}
</script>

<template>
  <dialog class="active">
    <h5>{{ recipeId ? 'Edit Recipe' : 'New Recipe' }}</h5>
    <div class="field border round">
      <input v-model="name" type="text" placeholder="Recipe name" />
    </div>
    <div class="field border round">
      <span class="label">Portions</span>
      <input v-model.number="portions" type="number" min="1" step="1" />
    </div>

    <h6>Ingredients</h6>
    <FoodSearch @select="addIngredient" />

    <table class="macro-table border">
      <thead>
        <tr>
          <th>Ingredient</th><th>Qty</th><th>Unit</th><th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(ing, idx) in ingredients" :key="idx">
          <td>{{ ing.foodName }}</td>
          <td><input v-model.number="ing.quantity" type="number" min="0" step="1" style="width: 70px" /></td>
          <td>
            <select v-model="ing.unit">
              <option value="g">g</option>
              <option value="ml">ml</option>
            </select>
          </td>
          <td><button class="chip circle" @click="removeIngredient(idx)"><i>delete</i></button></td>
        </tr>
      </tbody>
    </table>

    <div class="row">
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

    <nav>
      <button class="border round" @click="emit('close')">Cancel</button>
      <button class="round" @click="save">Save</button>
    </nav>
  </dialog>
</template>
