import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// GitHub Pages: https://avka3003.github.io/IssacPrograssMonitor/
export default defineConfig({
  plugins: [vue()],
  base: '/IssacPrograssMonitor/',
})
