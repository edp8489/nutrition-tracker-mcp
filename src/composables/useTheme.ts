import { computed, ref } from 'vue'
import { darkTheme, type GlobalTheme } from 'naive-ui'

const STORAGE_KEY = 'nt-theme'

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'dark'
  } catch {
    return false
  }
}

const isDark = ref(readStored())

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, isDark.value ? 'dark' : 'light')
  } catch {
    // storage unavailable (private mode) — session-only theme
  }
}

export function useTheme() {
  const theme = computed<GlobalTheme | null>(() => (isDark.value ? darkTheme : null))

  function toggle() {
    isDark.value = !isDark.value
    persist()
  }

  return { theme, isDark, toggle }
}
