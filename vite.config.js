import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Для GitHub Pages замени 'issacProgress' на имя своего репозитория
export default defineConfig({
  plugins: [vue()],
  base: '/issacProgress/',
})
