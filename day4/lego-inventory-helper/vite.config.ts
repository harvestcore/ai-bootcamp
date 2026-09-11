import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createApiHandler } from './server/api.ts'

/**
 * The local API is mounted straight into the dev server, so `npm run dev` is
 * still a single process and there is no proxy to keep in sync. In production
 * the very same handler is served by `server/index.ts`.
 */
function localApi() {
  return {
    name: 'lego-local-api',
    configureServer(server: { middlewares: { use: (fn: unknown) => void } }) {
      server.middlewares.use(createApiHandler())
    },
  }
}

export default defineConfig({
  // Relative base so the built app also works when served from a subfolder.
  base: './',
  plugins: [react(), tailwindcss(), localApi()],
  build: {
    target: 'es2022',
  },
})
