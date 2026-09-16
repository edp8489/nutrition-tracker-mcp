import { defineStore } from 'pinia'
import { liveQuery } from 'dexie'
import { ref, computed } from 'vue'
import { db } from '@/db/dexie'
import { computeRecipe } from '@/services/foodMcp'
import { servedToNutrition } from '@/utils/nutrition'
import type { Recipe, Ingredient, Macros, Nutrition100g } from '@/types/domain'
import { uuid } from '@/utils/uuid'

export const useRecipesStore = defineStore('recipes', () => {
  const recipes = ref<Recipe[]>([])
  const editing = ref<Recipe | null>(null)

  const subscription = liveQuery(() => db.recipes.toArray())
  subscription.subscribe((list) => {
    recipes.value = list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  })

  const sortedRecipes = computed(() => recipes.value)

  /**
   * All summation happens in the MCP tool (ADR-0020) — the app never
   * recomputes recipe macros from cached rows. The same call also yields the
   * full measured nutrient breakdown per portion (ADR-0026).
   */
  async function computePerPortion(
    ingredients: Ingredient[],
    portions: number,
  ): Promise<{ macros: Macros; nutrition: Nutrition100g | null }> {
    const result = await computeRecipe(ingredients, portions)
    if (!result.perServingMacros) throw new Error('computeRecipeMacros: no result')
    return {
      macros: result.perServingMacros,
      nutrition: servedToNutrition(result.perServingNutrition) ?? null,
    }
  }

  /**
   * Vue reactive proxies cannot be structured-cloned into IndexedDB
   * (DataCloneError) — copy ingredients to plain objects before writes.
   */
  function plainIngredients(ingredients: Ingredient[]): Ingredient[] {
    return ingredients.map((i) => ({
      foodId: i.foodId,
      foodName: i.foodName,
      quantity: i.quantity,
      unit: i.unit,
    }))
  }

  async function createRecipe(
    name: string,
    ingredients: Ingredient[],
    portions: number,
  ): Promise<string> {
    const now = new Date().toISOString()
    const id = uuid()
    const cleanIngredients = plainIngredients(ingredients)
    const { macros, nutrition } = await computePerPortion(cleanIngredients, portions)
    const recipe: Recipe = {
      id,
      name,
      ingredients: cleanIngredients,
      portions,
      perPortionMacros: macros,
      ...(nutrition ? { perPortionNutrition: nutrition } : {}),
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
    const cleanIngredients = plainIngredients(ingredients)
    const { macros, nutrition } = await computePerPortion(cleanIngredients, portions)
    await db.recipes.put({
      ...existing,
      name,
      ingredients: cleanIngredients,
      portions,
      perPortionMacros: macros,
      ...(nutrition ? { perPortionNutrition: nutrition } : {}),
      updatedAt: new Date().toISOString(),
    })
  }

  async function deleteRecipe(id: string): Promise<void> {
    await db.recipes.delete(id)
  }

  return {
    recipes: sortedRecipes,
    editing,
    createRecipe,
    updateRecipe,
    deleteRecipe,
    computePerPortion,
  }
})
