import Dexie, { type Table } from 'dexie'
import type {
  Food,
  Recipe,
  LogEntry,
  Favorite,
  Recent,
} from '@/types/domain'

export class NutritionDB extends Dexie {
  foods!: Table<Food, string>
  recipes!: Table<Recipe, string>
  logEntries!: Table<LogEntry, string>
  favorites!: Table<Favorite, string>
  recents!: Table<Recent, string>

  constructor() {
    super('nutrition-tracker')
    this.version(1).stores({
      foods: 'id, name, type',
      recipes: 'id, name, createdAt',
      logEntries: 'id, timestamp',
      favorites: 'foodId, addedAt',
      recents: 'foodId, lastUsedAt',
    })
  }
}

export const db = new NutritionDB()
