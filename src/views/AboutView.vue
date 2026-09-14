<script setup lang="ts"></script>

<template>
  <header><h5>About</h5></header>

  <n-card title="Nutrition Tracker">
    <p>A personal calorie and macro tracker. Uses the OpenNutrition dataset (v2025.1).</p>

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
