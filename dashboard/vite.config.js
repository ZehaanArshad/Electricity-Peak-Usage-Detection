import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Dev proxy — only used when running `npm run dev` locally.
    // In production (Vercel), VITE_API_URL points directly to the Render backend.
    proxy: {
      '/api':    { target: 'http://localhost:3001', changeOrigin: true },
      '/charts': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
})
