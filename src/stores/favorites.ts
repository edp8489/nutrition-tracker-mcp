import { defineStore } from 'pinia'
import { liveQuery } from 'dexie'
import { ref, computed } from 'vue'
import { db } from '@/db/dexie'

export const useFavoritesStore = defineStore('favorites', () => {
  const favoriteIds = ref<Set<string>>(new Set())

  const subscription = liveQuery(() => db.favorites.toArray())
  subscription.subscribe((list) => {
    favoriteIds.value = new Set(list.map((f) => f.foodId))
  })

  const isFavorite = computed(() => (foodId: string) =>
    favoriteIds.value.has(foodId),
  )

  async function toggle(foodId: string): Promise<void> {
    if (favoriteIds.value.has(foodId)) {
      await db.favorites.delete(foodId)
    } else {
      await db.favorites.put({
        foodId,
        addedAt: new Date().toISOString(),
      })
    }
  }

  return { favoriteIds, isFavorite, toggle }
})
