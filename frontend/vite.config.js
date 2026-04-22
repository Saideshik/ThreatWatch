import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ── LOCAL: point to your Ubuntu machine ─────────────────────────────────────
// Change this IP to your Ubuntu machine's IP address
const BACKEND = 'https://threatwatch-production.up.railway.app'

// ── CLOUD: once deployed to Railway/Render, replace above with your URL ──────
// const BACKEND = 'https://your-app.railway.app'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: BACKEND,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
