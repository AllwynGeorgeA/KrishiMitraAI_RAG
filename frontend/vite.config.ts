import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The SPA lives under /app so its routes never collide with API paths
// (/chat, /schemes, /conversations, ...). FastAPI serves the built files.
// Backend for `npm run dev`; override with KRISHIMITRA_API=http://localhost:8010 if 8000 is taken.
const API = process.env.KRISHIMITRA_API || 'http://localhost:8000'
const apiPaths = ['/chat', '/scheme', '/conversations', '/upload', '/schemes', '/stats', '/health']

export default defineConfig({
  base: '/app/',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: Object.fromEntries(apiPaths.map((p) => [p, { target: API, changeOrigin: true }])),
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: { manualChunks: (id) => (id.includes('node_modules/three') ? 'three' : undefined) },
    },
  },
})
