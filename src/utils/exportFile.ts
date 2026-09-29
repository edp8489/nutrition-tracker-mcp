/**
 * exportFile.ts — download helpers for export files (ADR-0027).
 */

export function downloadJson(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** "Breakfast Smoothie!" → "breakfast-smoothie" */
export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'recipe'
}

export function todayStamp(): string {
  return new Date().toISOString().slice(0, 10)
}
