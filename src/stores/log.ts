import { defineStore } from 'pinia'
import { liveQuery } from 'dexie'
import { ref, computed } from 'vue'
import { db } from '@/db/dexie'
import { foodMacrosForQuantity, multiplyMacros } from '@/utils/macros'
import { localDateOf } from '@/utils/dates'
import { foodNutritionForQuantity, multiplyNutrition } from '@/utils/nutrition'
import { uuid } from '@/utils/uuid'
import { useRecipesStore } from './recipes'
import type {
  Food,
  LogEntry,
  Macros,
  Nutrition100g,
  Unit,
  FoodLogRef,
  RecipeLogRef,
} from '@/types/domain'

export const useLogStore = defineStore('log', () => {
  const entries = ref<LogEntry[]>([])

  const subscription = liveQuery(() =>
    db.logEntries.orderBy('timestamp').reverse().toArray(),
  )
  subscription.subscribe((list) => {
    entries.value = list
  })

  const entriesByDate = computed(() => {
    const groups: Record<string, LogEntry[]> = {}
    for (const e of entries.value) {
      const date = localDateOf(e.timestamp)
      if (!groups[date]) groups[date] = []
      groups[date].push(e)
    }
    // sort dates desc
    const sorted: Array<[string, LogEntry[]]> = Object.entries(groups).sort((a, b) =>
      b[0].localeCompare(a[0]),
    )
    // within each date, sort by hour asc
    for (const [, list] of sorted) {
      list.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    }
    return sorted
  })

  function dayTotal(date: string): Macros {
    const dayEntries = entries.value.filter((e) => localDateOf(e.timestamp) === date)
    const total = { calories: 0, protein: 0, carbs: 0, fat: 0 }
    for (const e of dayEntries) {
      total.calories += e.snapshotMacros.calories
      total.protein += e.snapshotMacros.protein
      total.carbs += e.snapshotMacros.carbs
      total.fat += e.snapshotMacros.fat
    }
    return {
      calories: Math.round(total.calories * 100) / 100,
      protein: Math.round(total.protein * 100) / 100,
      carbs: Math.round(total.carbs * 100) / 100,
      fat: Math.round(total.fat * 100) / 100,
    }
  }

  function weekTotals(dates: string[]): Macros[] {
    return dates.map((d) => dayTotal(d))
  }

  async function addFoodLog(
    food: Food,
    quantity: number,
    unit: Unit,
    timestamp: string,
    note?: string,
  ): Promise<string> {
    const snapshotMacros = foodMacrosForQuantity(food.nutrition100g, quantity)
    const snapshotNutrition = foodNutritionForQuantity(food.nutrition100g, quantity)
    const id = uuid()
    const foodRef: FoodLogRef = {
      foodId: food.id,
      foodName: food.name,
      quantity,
      unit,
    }
    const entry: LogEntry = {
      id,
      timestamp: roundToQuarterHour(timestamp),
      kind: 'food',
      foodRef,
      snapshotMacros,
      ...(note !== undefined && note !== '' ? { note } : {}),
      ...(snapshotNutrition ? { snapshotNutrition } : {}),
      createdAt: new Date().toISOString(),
    }
    await db.logEntries.add(entry)
    await touchRecent(food.id)
    return id
  }

  async function addRecipeLog(
    recipeId: string,
    recipeName: string,
    portions: number,
    perPortionMacros: Macros,
    timestamp: string,
    perPortionNutrition?: Nutrition100g,
    note?: string,
  ): Promise<string> {
    const snapshotMacros = multiplyMacros(perPortionMacros, portions)
    const snapshotNutrition = multiplyNutrition(perPortionNutrition, portions)
    const id = uuid()
    const recipeRef: RecipeLogRef = { recipeId, recipeName, portions }
    const entry: LogEntry = {
      id,
      timestamp: roundToQuarterHour(timestamp),
      kind: 'recipe',
      recipeRef,
      snapshotMacros,
      ...(note !== undefined && note !== '' ? { note } : {}),
      ...(snapshotNutrition ? { snapshotNutrition } : {}),
      createdAt: new Date().toISOString(),
    }
    await db.logEntries.add(entry)
    return id
  }

  async function updateEntry(
    id: string,
    changes: Partial<Pick<LogEntry, 'timestamp' | 'note'>>,
  ): Promise<void> {
    const existing = await db.logEntries.get(id)
    if (!existing) return
    await db.logEntries.put({
      ...existing,
      ...changes,
      timestamp: changes.timestamp
        ? roundToQuarterHour(changes.timestamp)
        : existing.timestamp,
    })
  }

  async function deleteEntry(id: string): Promise<void> {
    await db.logEntries.delete(id)
  }

  async function entriesForDate(date: string): Promise<LogEntry[]> {
    const all = await db.logEntries.toArray()
    return all
      .filter((e) => localDateOf(e.timestamp) === date)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  }

  return {
    entries,
    entriesByDate,
    dayTotal,
    weekTotals,
    addFoodLog,
    addRecipeLog,
    updateEntry,
    deleteEntry,
    entriesForDate,
  }
})

function roundToQuarterHour(iso: string): string {
  const d = new Date(iso)
  d.setMinutes(Math.round(d.getMinutes() / 15) * 15, 0, 0)
  return d.toISOString()
}

async function touchRecent(foodId: string): Promise<void> {
  const now = new Date().toISOString()
  await db.recents.put({ foodId, lastUsedAt: now })
  const count = await db.recents.count()
  if (count > 50) {
    const oldest = await db.recents.orderBy('lastUsedAt').first()
    if (oldest) await db.recents.delete(oldest.foodId)
  }
}
