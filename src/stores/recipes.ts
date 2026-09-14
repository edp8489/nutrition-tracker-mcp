import { defineStore } from 'pinia'
import { liveQuery } from 'dexie'
import { ref, computed } from 'vue'
import { db } from '@/db/dexie'
import { computeRecipe } from '@/services/foodMcp'
import type { Recipe, Ingredient, Macros } from '@/types/domain'
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
   * recomputes recipe macros from cached rows.
   */
  async function computePerPortion(
    ingredients: Ingredient[],
    portions: number,
  ): Promise<Macros> {
    const { perServingMacros } = await computeRecipe(ingredients, portions)
    if (!perServingMacros) throw new Error('computeRecipeMacros: no result')
    return perServingMacros
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
    const perPortionMacros = await computePerPortion(cleanIngredients, portions)
    const recipe: Recipe = {
      id,
      name,
      ingredients: cleanIngredients,
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
    const cleanIngredients = plainIngredients(ingredients)
    const perPortionMacros = await computePerPortion(cleanIngredients, portions)
    await db.recipes.put({
      ...existing,
      name,
      ingredients: cleanIngredients,
      portions,
      perPortionMacros,
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
