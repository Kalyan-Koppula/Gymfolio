import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { PWA_ICON_REV } from './pwa-icon-rev'

function icon(src: string) {
  return `${src}?v=${PWA_ICON_REV}`
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    {
      name: 'gymfolio-icon-rev',
      transformIndexHtml(html) {
        return html.replaceAll('__ICON_REV__', PWA_ICON_REV)
      },
    },
    react(),
    tailwindcss(),
    VitePWA({
      // Activate new SW ASAP (skipWaiting + clientsClaim). Better for fixing bad caches;
      // less control than a "Reload?" prompt.
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: [
        'favicon.svg',
        'apple-touch-icon.png',
        'pwa-192.png',
        'pwa-512.png',
        'pwa-512-maskable.png',
      ],
      manifest: {
        // Stable app identity in Chromium; change icons via URL rev, not this id.
        id: '/',
        name: 'Gymfolio',
        short_name: 'Gymfolio',
        description: 'Workouts, macros, and progress — for you and your family',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: icon('pwa-192.png'),
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: icon('pwa-512.png'),
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: icon('pwa-512-maskable.png'),
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // App shell for client routes only — never claim /api (Pages Function / Worker).
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        // Don't precache the SW/workbox runtime themselves as navigations.
        globPatterns: ['**/*.{js,css,html,ico,svg,png,webp,woff2,webmanifest}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/api/media/exercises/') &&
              (url.pathname.endsWith('.webp') ||
                url.pathname.endsWith('.gif') ||
                url.pathname.endsWith('.jpg')),
            handler: 'CacheFirst',
            options: {
              cacheName: 'exercise-media-v2',
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: {
        // Keep SW off in `vite` — avoids stale-dev cache confusion.
        enabled: false,
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
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
})
