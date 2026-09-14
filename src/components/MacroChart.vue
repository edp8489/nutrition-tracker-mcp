<script setup lang="ts">
import { computed, ref } from 'vue'
import { useThemeVars } from 'naive-ui'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  type ChartOptions,
  type ChartData,
} from 'chart.js'
import type { Macros } from '@/types/domain'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
)

const props = defineProps<{
  labels: string[]
  data: Macros[]
}>()

const emit = defineEmits<{
  (e: 'click-day', date: string): void
}>()

const themeVars = useThemeVars()

const chartData = computed<ChartData<'bar'>>(() => ({
  labels: props.labels,
  datasets: [
    {
      label: 'Protein (g)',
      data: props.data.map((d) => d.protein),
      backgroundColor: '#00695c',
    },
    {
      label: 'Carbs (g)',
      data: props.data.map((d) => d.carbs),
      backgroundColor: '#ffb74d',
    },
    {
      label: 'Fat (g)',
      data: props.data.map((d) => d.fat),
      backgroundColor: '#e57373',
    },
  ],
}))

const chartOptions = computed<ChartOptions<'bar'>>(() => {
  const textColor = themeVars.value.textColor2
  const gridColor = themeVars.value.borderColor
  return {
    responsive: true,
    scales: {
      x: {
        stacked: true,
        ticks: { color: textColor },
        grid: { color: gridColor },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        ticks: { color: textColor },
        grid: { color: gridColor },
      },
    },
    plugins: {
      legend: { position: 'bottom', labels: { color: textColor } },
    },
    onClick: (_evt, elements) => {
      if (elements.length > 0) {
        const idx = elements[0].index
        emit('click-day', props.labels[idx])
      }
    },
  }
})
</script>

<template>
  <Bar :data="chartData" :options="chartOptions" />
</template>
