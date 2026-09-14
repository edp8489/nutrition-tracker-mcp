<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Capacitor } from '@capacitor/core'
import {
  BarChartOutline,
  CreateOutline,
  InformationCircleOutline,
  MoonOutline,
  RestaurantOutline,
  SunnyOutline,
} from '@vicons/ionicons5'
import { useDatasetStore } from '@/stores/dataset'
import { useTheme } from '@/composables/useTheme'

const dataset = useDatasetStore()
const router = useRouter()
const { theme, isDark, toggle } = useTheme()

onMounted(() => {
  dataset.init()
  if (!Capacitor.isNativePlatform() && import.meta.env.PROD && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
  }
})

const navItems = [
  { to: '/recipes', label: 'Recipes', icon: RestaurantOutline },
  { to: '/log', label: 'Log', icon: CreateOutline },
  { to: '/reports', label: 'Reports', icon: BarChartOutline },
  { to: '/about', label: 'About', icon: InformationCircleOutline },
]
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
