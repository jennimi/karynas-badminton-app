import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import ayoHandler from './api/ayo.ts'

/**
 * On Vercel, files in /api run as serverless functions. `npm run dev` doesn't do that,
 * so this mounts the same handler locally and /api/ayo works in both places.
 */
const localApi = (): Plugin => ({
  name: 'local-api',
  configureServer(server) {
    server.middlewares.use('/api/ayo', (req, res) => void ayoHandler(req, res))
  },
  configurePreviewServer(server) {
    server.middlewares.use('/api/ayo', (req, res) => void ayoHandler(req, res))
  },
})

export default defineConfig({
  plugins: [react(), tailwindcss(), localApi()],
})
