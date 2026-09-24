<script setup lang="ts">

</script>

<template>
  <header><h2>About</h2></header>

  <n-card title="Nutrition Tracker">
    <p>A personal calorie and macro tracker. Uses the OpenNutrition dataset (v2025.1).</p>

    <h4>Links</h4>
    <p>
      Project GitHub: 
      <a href="https://github.com/edp8489/nutrition-tracker-mcp">edp8489/nutrition-tracker-mcp</a>
    </p>
    <p>
     Homepage:
      <a href="https://www.epeters.io" target="_blank" rel="noopener">epeters.io</a>.
    </p>
    <p>
      Enjoy the app? Support development via
      <a href="https://buymeacoffee.com/epetersio" target="_blank" rel="noopener">BuyMeACoffee</a>.
    </p>

    <h4>Data attribution</h4>
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

    <h4>License</h4>
    <p>MIT</p>
    <p>
      The dataset extract stored in this application is a derivative database under ODbL.
      Attribution is displayed on every view that shows dataset-derived data.
    </p>

    <h4>Tech</h4>
    <p>
      Vue 3 + TypeScript + Vite · Naive UI · Pinia · Vue Router · Dexie (IndexedDB) · Chart.js 
    </p>
  </n-card>
</template>
