<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronBackOutline, ChevronForwardOutline } from '@vicons/ionicons5'
import { useRouter } from 'vue-router'
import { useLogStore } from '@/stores/log'
import MacroChart from '@/components/MacroChart.vue'
import MacroTable from '@/components/MacroTable.vue'
import NutritionTable from '@/components/NutritionTable.vue'
import AttributionFooter from '@/components/AttributionFooter.vue'
import { sumNutrition } from '@/utils/nutrition'
import { localDateOf } from '@/utils/dates'
import type { Macros } from '@/types/domain'
import type { ServedNutrient } from '@nutrition-tracker/shared/types'

const log = useLogStore()
const router = useRouter()

function startOfWeek(d = new Date()): Date {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}

const mode = ref<'week' | 'day'>('week')

const weekStart = ref<Date>(startOfWeek())

const weekDates = computed(() => {
  const dates: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart.value)
    d.setDate(weekStart.value.getDate() + i)
    dates.push(localDateOf(d.toISOString()))
  }
  return dates
})

const weekLabels = computed(() =>
  weekDates.value.map((d) => {
    const dt = new Date(d + 'T00:00:00')
    return dt.toLocaleDateString(undefined, { weekday: 'short' })
  }),
)

const weekData = computed<Macros[]>(() => log.weekTotals(weekDates.value))

const tableRows = computed(() =>
  weekDates.value.map((d, i) => ({
    label: `${weekLabels.value[i]} ${new Date(d + 'T00:00:00').getDate()}`,
    macros: weekData.value[i],
    date: d,
  })),
)

function clickDay(date: string) {
  router.push({ path: '/log', query: { date } })
}

function prevWeek() {
  const d = new Date(weekStart.value)
  d.setDate(d.getDate() - 7)
  weekStart.value = d
}

function nextWeek() {
  const d = new Date(weekStart.value)
  d.setDate(d.getDate() + 7)
  weekStart.value = d
}

function thisWeek() {
  weekStart.value = startOfWeek()
}

// --- day view (ADR-0026) ---------------------------------------------------

const today = localDateOf(new Date().toISOString())
const dayDate = ref<string>(today)

const dayEntries = computed(() =>
  log.entries.filter((e) => localDateOf(e.timestamp) === dayDate.value),
)

const coveredCount = computed(
  () => dayEntries.value.filter((e) => e.snapshotNutrition).length,
)

const CORE_KEYS = ['calories', 'protein', 'carbohydrates', 'total_fat']

const dayNutritionRows = computed<ServedNutrient[]>(() => {
  // Core four always cover every entry — snapshotMacros predates ADR-0026.
  const macros = log.dayTotal(dayDate.value)
  const rows: ServedNutrient[] = [
    { key: 'calories', value: macros.calories, measured: true },
    { key: 'protein', value: macros.protein, measured: true },
    { key: 'carbohydrates', value: macros.carbs, measured: true },
    { key: 'total_fat', value: macros.fat, measured: true },
  ]
  const snapshots = dayEntries.value.filter((e) => e.snapshotNutrition)
  if (snapshots.length > 0) {
    const total = sumNutrition(snapshots.map((e) => e.snapshotNutrition!))
    for (const [key, value] of Object.entries(total)) {
      if (CORE_KEYS.includes(key) || value === undefined) continue
      rows.push({ key, value, measured: true })
    }
  }
  return rows
})

function formatDateLabel(date: string): string {
  const d = new Date(date + 'T00:00:00')
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function prevDay() {
  const d = new Date(dayDate.value + 'T00:00:00')
  d.setDate(d.getDate() - 1)
  dayDate.value = localDateOf(d.toISOString())
}

function nextDay() {
  const d = new Date(dayDate.value + 'T00:00:00')
  d.setDate(d.getDate() + 1)
  dayDate.value = localDateOf(d.toISOString())
}

function todayDay() {
  dayDate.value = today
}
</script>

<template>
  <header><h2>Reports</h2></header>

  <n-tabs v-model:value="mode" type="segment" size="small" style="margin-top: 8px">
    <n-tab name="week">Week</n-tab>
    <n-tab name="day">Day</n-tab>
  </n-tabs>

  <template v-if="mode === 'week'">
    <div class="row" style="margin-top: 8px">
      <n-button quaternary circle @click="prevWeek">
        <template #icon>
          <n-icon :component="ChevronBackOutline" />
        </template>
      </n-button>
      <n-button @click="thisWeek">This week</n-button>
      <n-button quaternary circle @click="nextWeek">
        <template #icon>
          <n-icon :component="ChevronForwardOutline" />
        </template>
      </n-button>
    </div>

    <n-card style="margin-top: 8px">
      <div class="chart-container">
        <MacroChart :labels="weekLabels" :data="weekData" @click-day="clickDay" />
      </div>
    </n-card>

    <n-card style="margin-top: 8px">
      <MacroTable :rows="tableRows" />
    </n-card>
  </template>

  <template v-else>
    <div class="row" style="margin-top: 8px">
      <n-button quaternary circle @click="prevDay">
        <template #icon>
          <n-icon :component="ChevronBackOutline" />
        </template>
      </n-button>
      <n-date-picker
        v-model:formatted-value="dayDate"
        type="date"
        value-format="yyyy-MM-dd"
        style="width: 160px"
      />
      <n-button size="small" @click="todayDay">Today</n-button>
      <n-button quaternary circle @click="nextDay">
        <template #icon>
          <n-icon :component="ChevronForwardOutline" />
        </template>
      </n-button>
    </div>

    <n-card style="margin-top: 8px">
      <div class="row">
        <h6>{{ formatDateLabel(dayDate) }}</h6>
        <div class="col right-align">
          <small>
            {{ dayEntries.length }} {{ dayEntries.length === 1 ? 'entry' : 'entries' }}
          </small>
        </div>
      </div>
      <p v-if="dayEntries.length === 0" class="center-align">
        No entries logged this day.
      </p>
      <template v-else>
        <NutritionTable :rows="dayNutritionRows" />
        <small
          v-if="coveredCount < dayEntries.length"
          class="center-align"
          style="display: block"
        >
          Full breakdown covers {{ coveredCount }} of {{ dayEntries.length }} entries —
          entries logged before detailed snapshots contribute macros only.
        </small>
      </template>
    </n-card>
  </template>

  <AttributionFooter />
</template>
