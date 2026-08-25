import { defineStore } from 'pinia'
import { liveQuery } from 'dexie'
import { ref, computed } from 'vue'
import { db } from '@/db/dexie'
import { useFoodsStore } from './foods'
import { foodMacrosForQuantity, sumMacros, divideMacros } from '@/utils/macros'
import type { Recipe, Ingredient, Macros } from '@/types/domain'
import { uuid } from '@/utils/uuid'

export const useRecipesStore = defineStore('recipes', () => {
  const recipes = ref<Recipe[]>([])
  const editing = ref<Recipe | null>(null)

  const subscription = liveQuery(() => db.recipes.toArray())
  subscription.subscribe((list) => {
    recipes.value = list.sort(
      (a, b) => b.updatedAt.localeCompare(a.updatedAt),
    )
  })

  const sortedRecipes = computed(() => recipes.value)

  async function createRecipe(
    name: string,
    ingredients: Ingredient[],
    portions: number,
  ): Promise<string> {
    const now = new Date().toISOString()
    const id = uuid()
    const perPortionMacros = computeRecipeMacros(ingredients, portions)
    const recipe: Recipe = {
      id,
      name,
      ingredients,
      portions,
      perPortionMacros,
      createdAt: now,
      updatedAt: now,
    }
    await db.recipes.add(recipe)
    return id
  }

  async function updateRecipe(
    id: string,
    name: string,
    ingredients: Ingredient[],
    portions: number,
  ): Promise<void> {
    const existing = await db.recipes.get(id)
    if (!existing) return
    const perPortionMacros = computeRecipeMacros(ingredients, portions)
    await db.recipes.put({
      ...existing,
      name,
      ingredients,
      portions,
      perPortionMacros,
      updatedAt: new Date().toISOString(),
    })
  }

  async function deleteRecipe(id: string): Promise<void> {
    await db.recipes.delete(id)
  }

  function computeRecipeMacros(
    ingredients: Ingredient[],
    portions: number,
  ): Macros {
    const foodsStore = useFoodsStore()
    // Synchronous helper for when all foods are already in memory;
    // for async path see computeRecipeMacrosAsync
    const macrosList: Macros[] = []
    for (const ing of ingredients) {
      // We can't await in this sync fn; use cached search results as fallback
      const food = foodsStore.searchResults.find((f) => f.id === ing.foodId)
      if (food) {
        macrosList.push(foodMacrosForQuantity(food.nutrition100g, ing.quantity))
      }
    }
    const total = sumMacros(macrosList)
    return divideMacros(total, portions)
  }

  async function computeRecipeMacrosAsync(
    ingredients: Ingredient[],
    portions: number,
  ): Promise<Macros> {
    const macrosList: Macros[] = []
    for (const ing of ingredients) {
      const food = await db.foods.get(ing.foodId)
      if (food) {
        macrosList.push(foodMacrosForQuantity(food.nutrition100g, ing.quantity))
      }
    }
    const total = sumMacros(macrosList)
    return divideMacros(total, portions)
  }

  return {
    recipes: sortedRecipes,
    editing,
    createRecipe,
    updateRecipe,
    deleteRecipe,
    computeRecipeMacros,
    computeRecipeMacrosAsync,
  }
})
