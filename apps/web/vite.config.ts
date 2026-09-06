import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons.svg'],
      manifest: {
        name: 'Gymfolio',
        short_name: 'Gymfolio',
        description: 'Workouts, macros, and progress — for you and your family',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'icons.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // App shell for client routes only — never claim /api (Pages Function / Worker).
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          // Media files only (images). Must be before the /api catch-all.
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/api/media/exercises/') &&
              (url.pathname.endsWith('.webp') ||
                url.pathname.endsWith('.gif') ||
                url.pathname.endsWith('.jpg')),
            handler: 'CacheFirst',
            options: {
              // New name busts caches that may hold SPA HTML from broken /api deploys.
              cacheName: 'exercise-media-v2',
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // All other /api/* — network only (never cache JSON/HTML mistakes).
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    proxy: {
      // Same-origin in dev, avoiding CORS entirely — mirrors how the Worker sits behind
      // the same custom domain as the static site in production (architecture §10).
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
})
