/// <reference types="vitest" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  base: '/nutrition-tracker/',
  plugins: [vue()],
  server: {
    proxy: {
      // ADR-0021: dev proxies MCP calls to the local MCP server process
      '/mcp': {
        target: `http://localhost:${process.env.NUTRITION_PORT ?? 3000}`,
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsInlineLimit: 4096,
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
})
