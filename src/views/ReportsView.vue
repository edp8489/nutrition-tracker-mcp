<script setup lang="ts">
import { computed, ref } from 'vue'
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
  <header><h5>Reports</h5></header>

  <div class="row">
    <button class="chip circle" @click="prevWeek"><i>chevron_left</i></button>
    <button class="chip" @click="thisWeek">This week</button>
    <button class="chip circle" @click="nextWeek"><i>chevron_right</i></button>
  </div>

  <article class="card padding">
    <MacroChart
      :labels="weekLabels"
      :data="weekData"
      @click-day="clickDay"
    />
  </article>

  <article class="card padding">
    <MacroTable :rows="tableRows" />
  </article>

  <AttributionFooter />
</template>
