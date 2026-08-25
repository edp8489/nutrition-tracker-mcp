import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db } from '@/db/dexie'
import { useFoodsStore } from './foods'
import type { Food, ChunkManifest } from '@/types/domain'

const BASE = '/nutrition-tracker/data'

export const useDatasetStore = defineStore('dataset', () => {
  const manifest = ref<ChunkManifest | null>(null)
  const initialized = ref(false)
  const loadingChunk = ref<string | null>(null)

  async function init(): Promise<void> {
    if (initialized.value) return
    initialized.value = true

    const foodsStore = useFoodsStore()
    const count = await foodsStore.countFoods()
    if (count === 0) {
      await loadSubset()
    }
    await loadManifest()
  }

  async function loadManifest(): Promise<void> {
    try {
      const res = await fetch(`${BASE}/manifest.json`)
      if (!res.ok) return
      manifest.value = (await res.json()) as ChunkManifest
    } catch {
      // manifest optional during dev
    }
  }

  async function loadSubset(): Promise<void> {
    try {
      const res = await fetch(`${BASE}/subset.jsonl`)
      if (!res.ok) return
      const reader = res.body?.getReader()
      if (!reader) return
      const decoder = new TextDecoder()
      let buffer = ''
      const batch: Food[] = []
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            batch.push(JSON.parse(line) as Food)
          } catch {
            // skip malformed
          }
          if (batch.length >= 500) {
            await db.foods.bulkPut(batch.splice(0))
          }
        }
      }
      if (batch.length) await db.foods.bulkPut(batch)
    } catch {
      // subset optional during dev
    }
  }

  async function ensureChunkForQuery(query: string): Promise<void> {
    const foodsStore = useFoodsStore()
    const first = query.trim().charAt(0).toLowerCase()
    const bucket = /[a-z]/.test(first)
      ? first
      : /[0-9]/.test(first)
        ? '0-9'
        : '_'
    if (foodsStore.isChunkLoaded(bucket)) return
    if (!manifest.value) return
    const entry = manifest.value.chunks.find((c) =>
      c.firstChars.split(',').includes(bucket),
    )
    if (!entry) return
    loadingChunk.value = bucket
    try {
      const res = await fetch(`${BASE}/chunks/${entry.chunkFile}`)
      if (!res.ok) return
      const reader = res.body?.getReader()
      if (!reader) return
      const decoder = new TextDecoder()
      let buffer = ''
      const batch: Food[] = []
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            batch.push(JSON.parse(line) as Food)
          } catch {
            // skip
          }
          if (batch.length >= 500) {
            await db.foods.bulkPut(batch.splice(0))
          }
        }
      }
      if (batch.length) await db.foods.bulkPut(batch)
      foodsStore.markChunkLoaded(bucket)
    } finally {
      loadingChunk.value = null
    }
  }

  return {
    manifest,
    initialized,
    loadingChunk,
    init,
    loadManifest,
    loadSubset,
    ensureChunkForQuery,
  }
})
