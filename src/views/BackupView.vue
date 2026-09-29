<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  mergeExport,
  parseExportFile,
  serializeExportFile,
  type ExportLogEntry,
  type ExportRecipe,
  type MergeReport,
} from '@nutrition-tracker/shared/serialization'
import { useRecipesStore } from '@/stores/recipes'
import { useLogStore } from '@/stores/log'
import { db } from '@/db/dexie'
import { localDateOf } from '@/utils/dates'
import { downloadJson, todayStamp } from '@/utils/exportFile'
import type { LogEntry, Recipe } from '@/types/domain'

const recipes = useRecipesStore()
const log = useLogStore()

// --- export -----------------------------------------------------------------

const includeRecipes = ref(true)
const includeLog = ref(true)
const logRange = ref<[number, number] | null>(null)

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

function selectedLogEntries(): LogEntry[] {
  if (!includeLog.value) return []
  const entries = log.entries
  if (!logRange.value) return entries
  const from = localDateOf(new Date(logRange.value[0]).toISOString())
  const to = localDateOf(new Date(logRange.value[1]).toISOString())
  return entries.filter((e) => {
    const d = localDateOf(e.timestamp)
    return d >= from && d <= to
  })
}

const exportWarning = ref<string | null>(null)

function exportFilename(): string {
  const stamp = todayStamp()
  let range = ''
  if (includeLog.value) {
    range = logRange.value
      ? `${localDateOf(new Date(logRange.value[0]).toISOString())}_${localDateOf(
          new Date(logRange.value[1]).toISOString(),
        )}`
      : 'full'
  }
  
  const prefix=`nutrition-tracker-export-${stamp}`
  const exportRecipesSlug = includeRecipes.value ? "_recipes" : ""
  const exportLogSlug = includeLog.value ? `_log_${range}` : ""

  return `${prefix}${exportRecipesSlug}${exportLogSlug}.json`
}

function doExport() {
  exportWarning.value = null
  const recipeList = includeRecipes.value ? clone(recipes.recipes) : []
  const logList = includeLog.value ? clone(selectedLogEntries()) : undefined
  if (includeLog.value && logRange.value && logList && logList.length === 0) {
    exportWarning.value =
      'Selected date range contains no log entries. Nothing was exported.'
    return
  }
  downloadJson(exportFilename(), serializeExportFile(recipeList, logList))
}

// --- import -----------------------------------------------------------------

interface Pending {
  recipes: ExportRecipe[]
  logEntries: ExportLogEntry[]
  errors: string[]
  filename: string
}

const fileInput = ref<HTMLInputElement | null>(null)
const pending = ref<Pending | null>(null)
const parseError = ref<string | null>(null)
const importReport = ref<MergeReport | null>(null)
const confirmingReplace = ref(false)

const localCounts = computed(() => ({
  recipes: recipes.recipes.length,
  logEntries: log.entries.length,
}))

async function onFileChange(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  parseError.value = null
  importReport.value = null
  pending.value = null
  if (!file) return
  const text = await file.text()
  const parsed = parseExportFile(text)
  if (!parsed.ok) {
    parseError.value = parsed.errors[0] ?? 'invalid file'
    return
  }
  pending.value = {
    recipes: parsed.recipes,
    logEntries: parsed.logEntries,
    errors: parsed.errors,
    filename: file.name,
  }
}

async function doMerge() {
  if (!pending.value) return
  const result = mergeExport(
    { recipes: clone(recipes.recipes), logEntries: clone(log.entries) },
    { recipes: pending.value.recipes, logEntries: pending.value.logEntries },
  )
  // Vue reactive proxies cannot be structured-cloned into IndexedDB.
  await db.recipes.bulkPut(clone(result.merged.recipes))
  const existingIds = new Set(log.entries.map((e) => e.id))
  const newEntries = result.merged.logEntries.filter((e) => !existingIds.has(e.id))
  if (newEntries.length > 0) await db.logEntries.bulkPut(clone(newEntries))
  importReport.value = result.report
  pending.value = null
}

async function doReplace() {
  if (!pending.value) return
  confirmingReplace.value = false
  await db.recipes.clear()
  await db.logEntries.clear()
  await db.recipes.bulkPut(clone(pending.value.recipes))
  await db.logEntries.bulkPut(clone(pending.value.logEntries))
  importReport.value = {
    recipesAdded: pending.value.recipes.length,
    recipesUpdated: 0,
    recipesUnchanged: 0,
    logEntriesAdded: pending.value.logEntries.length,
    logEntriesSkipped: 0,
  }
  pending.value = null
}
</script>

<template>
  <header><h2>Backup</h2></header>

  <n-card title="Export" style="margin-top: 8px">
    <n-space vertical>
      <n-checkbox v-model:checked="includeRecipes">Recipes</n-checkbox>
      <n-checkbox v-model:checked="includeLog">Log entries</n-checkbox>
      <div v-if="includeLog">
        <p><b>Date Range</b><br /><i>Leave blank for full history.</i></p>
        <n-date-picker v-model:value="logRange" type="daterange" clearable />
      </div>
      <n-button
        style="margin-top: 8px"
        type="primary"
        :disabled="!includeRecipes && !includeLog"
        @click="doExport"
      >
        Export to JSON file
      </n-button>

      <n-alert v-if="exportWarning" type="warning" :show-icon="false">
        {{ exportWarning }}
      </n-alert>
    </n-space>
  </n-card>

  <n-card title="Import" style="margin-top: 8px">
    <n-space vertical>
      <input
        ref="fileInput"
        type="file"
        accept=".json,application/json"
        style="display: none"
        @change="onFileChange"
      />
      <n-button @click="fileInput?.click()">Choose file…</n-button>

      <n-alert v-if="parseError" type="error" :show-icon="false">
        {{ parseError }}
      </n-alert>

      <template v-if="pending">
        <p>
          {{ pending.filename }}: {{ pending.recipes.length }} recipe(s),
          {{ pending.logEntries.length }} log entr(y/ies) valid.
        </p>
        <n-alert
          v-if="pending.errors.length > 0"
          type="warning"
          title="Some items were rejected"
          :show-icon="false"
        >
          <p v-for="err in pending.errors" :key="err">{{ err }}</p>
        </n-alert>
        <n-space>
          <n-button type="primary" @click="doMerge">Merge into my data</n-button>
          <n-button type="error" ghost @click="confirmingReplace = true">
            Replace all data
          </n-button>
        </n-space>
      </template>

      <n-alert v-if="importReport" type="success" :show-icon="false">
        Imported: {{ importReport.recipesAdded }} recipe(s) added,
        {{ importReport.recipesUpdated }} updated, {{ importReport.logEntriesAdded }} log
        entr(y/ies) added.
      </n-alert>
    </n-space>
  </n-card>

  <n-modal
    :show="confirmingReplace"
    preset="card"
    title="Replace all data?"
    style="max-width: 420px"
    @update:show="(v: boolean) => (confirmingReplace = v)"
  >
    <p>
      This will delete {{ localCounts.recipes }} recipe(s) and
      {{ localCounts.logEntries }} log entr(y/ies), replacing them with the imported
      file's contents. This cannot be undone.
    </p>
    <template #footer>
      <n-space justify="end">
        <n-button @click="confirmingReplace = false">Cancel</n-button>
        <n-button type="error" @click="doReplace">Replace all</n-button>
      </n-space>
    </template>
  </n-modal>
</template>
