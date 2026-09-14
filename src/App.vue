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
  <n-config-provider :theme="theme">
    <main>
    <router-view />
  </main>
    <nav class="bottom">
      <n-button
        v-for="item in navItems"
        :key="item.to"
        quaternary
        :type="$route.path === item.to ? 'primary' : 'default'"
        @click="router.push(item.to)"
      >
        <template #icon>
          <n-icon :component="item.icon" />
        </template>
        {{ item.label }}
      </n-button>
      <n-button
        quaternary
        class="nav-toggle"
        :title="isDark ? 'Light mode' : 'Dark mode'"
        @click="toggle"
      >
        <template #icon>
          <n-icon :component="isDark ? SunnyOutline : MoonOutline" />
        </template>
      </n-button>
    </nav>
  </n-config-provider>
</template>
