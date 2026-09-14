import { defineStore } from 'pinia'
import { liveQuery } from 'dexie'
import { ref, computed } from 'vue'
import { db } from '@/db/dexie'
import { useFoodsStore } from './foods'

export const useFavoritesStore = defineStore('favorites', () => {
  const favoriteIds = ref<Set<string>>(new Set())

  const subscription = liveQuery(() => db.favorites.toArray())
  subscription.subscribe((list) => {
    favoriteIds.value = new Set(list.map((f) => f.foodId))
  })

  const isFavorite = computed(() => (foodId: string) => favoriteIds.value.has(foodId))

  async function toggle(foodId: string): Promise<void> {
    if (favoriteIds.value.has(foodId)) {
      await db.favorites.delete(foodId)
    } else {
      await db.favorites.put({
        foodId,
        addedAt: new Date().toISOString(),
      })
      // Keep the Dexie cache warm so the empty-query favorites list can
      // render this food without a search hit in the same session
      void useFoodsStore().cacheFood(foodId)
    }
  }

  return { favoriteIds, isFavorite, toggle }
})
