import type { Macros, Nutrition100g, Unit } from '@/types/domain'

export function foodMacrosForQuantity(
  nutrition100g: Nutrition100g | null | undefined,
  quantity: number,
): Macros {
  const factor = quantity / 100
  return {
    calories: round2((nutrition100g?.calories ?? 0) * factor),
    protein: round2((nutrition100g?.protein ?? 0) * factor),
    carbs: round2((nutrition100g?.carbohydrates ?? 0) * factor),
    fat: round2((nutrition100g?.total_fat ?? 0) * factor),
  }
}

export function sumMacros(macros: Macros[]): Macros {
  return macros.reduce(
    (acc, m) => ({
      calories: round2(acc.calories + m.calories),
      protein: round2(acc.protein + m.protein),
      carbs: round2(acc.carbs + m.carbs),
      fat: round2(acc.fat + m.fat),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )
}

export function divideMacros(m: Macros, portions: number): Macros {
  if (portions <= 0) return { calories: 0, protein: 0, carbs: 0, fat: 0 }
  return {
    calories: round2(m.calories / portions),
    protein: round2(m.protein / portions),
    carbs: round2(m.carbs / portions),
    fat: round2(m.fat / portions),
  }
}

export function multiplyMacros(m: Macros, n: number): Macros {
  return {
    calories: round2(m.calories * n),
    protein: round2(m.protein * n),
    carbs: round2(m.carbs * n),
    fat: round2(m.fat * n),
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function unitLabel(unit: Unit): string {
  return unit
}
