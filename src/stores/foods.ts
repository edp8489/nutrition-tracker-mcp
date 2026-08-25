import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db } from '@/db/dexie'
import type { Food, FoodType } from '@/types/domain'

export const useFoodsStore = defineStore('foods', () => {
  const searchResults = ref<Food[]>([])
  const searching = ref(false)
  const loadedChunkPrefixes = ref<Set<string>>(new Set())

  async function searchLocal(query: string, type?: FoodType): Promise<Food[]> {
    const q = query.trim().toLowerCase()
    if (!q) {
      const favs = await db.favorites.toArray()
      const favFoods = await Promise.all(
        favs.map((f) => db.foods.get(f.foodId)),
      )
      searchResults.value = favFoods.filter(Boolean) as Food[]
      return searchResults.value
    }

    let collection = db.foods.toCollection()
    const all = await collection.toArray()
    let filtered = all.filter((f) => {
      const inName = f.name.toLowerCase().includes(q)
      const inAlt = f.altNames.some((a) => a.toLowerCase().includes(q))
      return inName || inAlt
    })
    if (type) filtered = filtered.filter((f) => f.type === type)

    filtered.sort((a, b) => {
      const an = a.name.toLowerCase()
      const bn = b.name.toLowerCase()
      const ai = an.indexOf(q)
      const bi = bn.indexOf(q)
      if (ai === 0 && bi !== 0) return -1
      if (bi === 0 && ai !== 0) return 1
      return an.localeCompare(bn)
    })

    searchResults.value = filtered.slice(0, 100)
    return searchResults.value
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
    loadedChunkPrefixes,
    searchLocal,
    getFood,
    bulkPutFoods,
    countFoods,
    markChunkLoaded,
    isChunkLoaded,
  }
})
