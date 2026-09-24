<script setup lang="ts">
import { onMounted, ref } from 'vue'

const bmcRef = ref<HTMLDivElement | null>(null)

onMounted(() => {
  const container = bmcRef.value
  if (!container) return
  const script = document.createElement('script')
  script.type = 'text/javascript'
  script.src = 'https://cdnjs.buymeacoffee.com/1.0.0/button.prod.min.js'
  script.setAttribute('data-name', 'bmc-button')
  script.setAttribute('data-slug', 'epetersio')
  script.setAttribute('data-color', '#5F7FFF')
  script.setAttribute('data-emoji', '👨🏻‍💻')
  script.setAttribute('data-font', 'Cookie')
  script.setAttribute('data-text', 'Buy me a coffee')
  script.setAttribute('data-outline-color', '#000000')
  script.setAttribute('data-font-color', '#ffffff')
  script.setAttribute('data-coffee-color', '#FFDD00')
  container.appendChild(script)
})
</script>

<template>
  <header><h2>About</h2></header>

  <n-card title="Nutrition Tracker">
    <p>A personal calorie and macro tracker. Uses the OpenNutrition dataset (v2025.1).</p>

    <h6>Links</h6>
    <p>
      Visit the author site:
      <a href="https://www.epeters.io" target="_blank" rel="noopener">epeters.io</a>.
    </p>
    <p>
      Enjoy the app? Support development with
      <a href="https://buymeacoffee.com/epetersio" target="_blank" rel="noopener">a coffee</a>.
    </p>
    <div ref="bmcRef"></div>

    <h6>Data attribution</h6>
    <p>
      Food data provided by
      <a href="https://www.opennutrition.app" target="_blank" rel="noopener">OpenNutrition</a>
      under the
      <a href="http://opendatacommons.org/licenses/odbl/1.0/" target="_blank" rel="noopener">
        Open Database License (ODbL) v1.0
      </a>.
    </p>
    <p>
      Portions of the data incorporate content from
      <a href="https://world.openfoodfacts.org" target="_blank" rel="noopener">Open Food Facts</a>
      contributors, licensed under ODbL.
    </p>

    <h6>License</h6>
    <p>
      The dataset extract stored in this application is a derivative database under ODbL.
      Attribution is displayed on every view that shows dataset-derived data.
    </p>

    <h6>Tech</h6>
    <p>
      Vue 3 + TypeScript + Vite · Naive UI · Pinia · Vue Router · Dexie (IndexedDB) · Chart.js ·
      Capacitor (Android)
    </p>
  </n-card>
</template>
