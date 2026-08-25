<script setup lang="ts">
import { onMounted } from 'vue'
import { useDatasetStore } from '@/stores/dataset'

const dataset = useDatasetStore()

onMounted(() => {
  dataset.init()
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('/nutrition-tracker/sw.js')
      .catch(() => {
        // SW registration failure non-fatal in dev
      })
  }
})
</script>

<template>
  <nav class="bottom">
    <a href="/nutrition-tracker/recipes" @click.prevent="$router.push('/recipes')">
      <i>restaurant</i>
      <span>Recipes</span>
    </a>
    <a href="/nutrition-tracker/log" @click.prevent="$router.push('/log')">
      <i>edit_note</i>
      <span>Log</span>
    </a>
    <a href="/nutrition-tracker/reports" @click.prevent="$router.push('/reports')">
      <i>bar_chart</i>
      <span>Reports</span>
    </a>
    <a href="/nutrition-tracker/about" @click.prevent="$router.push('/about')">
      <i>info</i>
      <span>About</span>
    </a>
  </nav>
  <main class="responsive">
    <router-view />
  </main>
</template>
