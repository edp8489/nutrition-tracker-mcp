<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronBackOutline, ChevronForwardOutline } from '@vicons/ionicons5'
import { useRouter } from 'vue-router'
import { useLogStore } from '@/stores/log'
import MacroChart from '@/components/MacroChart.vue'
import MacroTable from '@/components/MacroTable.vue'
import AttributionFooter from '@/components/AttributionFooter.vue'
import type { Macros } from '@/types/domain'

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

const weekStart = ref<Date>(startOfWeek())

const weekDates = computed(() => {
  const dates: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart.value)
    d.setDate(weekStart.value.getDate() + i)
    dates.push(d.toISOString().slice(0, 10))
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
</script>

<template>
  <header><h2>Reports</h2></header>

  <div class="row">
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
    <MacroChart
      :labels="weekLabels"
      :data="weekData"
      @click-day="clickDay"
    />
  </n-card>

  <n-card style="margin-top: 8px">
    <MacroTable :rows="tableRows" />
  </n-card>

  <AttributionFooter />
</template>
