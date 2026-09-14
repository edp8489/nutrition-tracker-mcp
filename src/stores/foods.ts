import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db } from '@/db/dexie'
import {
  getIngredientMacros,
  hitToFood,
  detailToFood,
  searchIngredients,
} from '@/services/foodMcp'
import type { Food, FoodType } from '@/types/domain'

/**
 * Food data comes from the MCP server (ADR-0021); the Dexie `foods` table is
 * a write-through cache of full records (populated on detail fetch and
 * favorites-add, plus legacy subset rows) so favorites/recents render
 * without a server round-trip.
 */
export const useFoodsStore = defineStore('foods', () => {
  const searchResults = ref<Food[]>([])
  const searching = ref(false)
  const searchError = ref<string | null>(null)
  // Legacy chunk bookkeeping, kept for the deferred external/Android paths
  const loadedChunkPrefixes = ref<Set<string>>(new Set())

  async function search(query: string, type?: FoodType): Promise<Food[]> {
    const q = query.trim()
    searching.value = true
    searchError.value = null
    try {
      if (!q) {
        const favs = await db.favorites.toArray()
        const favFoods = await Promise.all(favs.map((f) => db.foods.get(f.foodId)))
        searchResults.value = favFoods.filter(Boolean) as Food[]
      } else {
        const { hits } = await searchIngredients(q, type)
        searchResults.value = hits.map(hitToFood)
      }
    } catch (err) {
      searchError.value = err instanceof Error ? err.message : String(err)
      searchResults.value = []
    } finally {
      searching.value = false
    }
    return searchResults.value
  }

  /** Full macros for a search hit; caches to Dexie (favorites/recents). */
  async function getDetail(food: Food): Promise<Food> {
    const full = detailToFood(await getIngredientMacros(food.id), food)
    await db.foods.put(full)
    return full
  }

  /** Ensure a food (e.g. freshly favorited) is in the Dexie cache. */
  async function cacheFood(id: string): Promise<void> {
    if (await db.foods.get(id)) return
    await db.foods.put(detailToFood(await getIngredientMacros(id)))
  }

  async function getFood(id: string): Promise<Food | undefined> {
    return db.foods.get(id)
  }

  async function bulkPutFoods(foods: Food[]): Promise<void> {
    await db.foods.bulkPut(foods)
  }

  async function countFoods(): Promise<number> {
    return db.foods.count()
  }

  function markChunkLoaded(prefix: string): void {
    loadedChunkPrefixes.value.add(prefix)
  }

  function isChunkLoaded(prefix: string): boolean {
    return loadedChunkPrefixes.value.has(prefix)
  }

  return {
    searchResults,
    searching,
    searchError,
    loadedChunkPrefixes,
    search,
    getDetail,
    cacheFood,
    getFood,
    bulkPutFoods,
    countFoods,
    markChunkLoaded,
    isChunkLoaded,
  }
})
