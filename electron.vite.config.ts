import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'node:path'

export default defineConfig({
  main: { plugins: [externalizeDepsPlugin()], build: { rollupOptions: { input: resolve('electron/main/index.ts') } } },
  preload: { plugins: [externalizeDepsPlugin()], build: { rollupOptions: { input: resolve('electron/preload/index.ts') } } },
  renderer: {
    root: 'src/renderer',
    resolve: { alias: { '@': resolve('src/renderer'), '@shared': resolve('src/shared') } },
    plugins: [vue()],
    build: { rollupOptions: { input: resolve('src/renderer/index.html') } }
  }
})
