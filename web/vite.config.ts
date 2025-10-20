import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://api:3001',
        changeOrigin: true,
      },
      '/status': {
        target: 'http://api:3001',
        changeOrigin: true,
      }
    }
  }
})
