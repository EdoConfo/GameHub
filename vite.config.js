import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// IMPORTANT: base path must match the GitHub repo name for GitHub Pages.
// Repo: https://github.com/EdoConfo/GameHub  ->  site served at /GameHub/
// If you rename the repo, change BASE here (keep the leading and trailing slash).
const BASE = '/GameHub/'

export default defineConfig({
  base: BASE,
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png'],
      workbox: {
        // Precache everything the build emits, including bundled word-pack JSON.
        globPatterns: ['**/*.{js,css,html,svg,png,json,woff2}'],
        navigateFallback: BASE + 'index.html'
      },
      manifest: {
        name: 'GameHub',
        short_name: 'GameHub',
        description: 'Hub di giochi da tavolo per feste. Funziona offline, un solo dispositivo.',
        lang: 'it',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0f1020',
        theme_color: '#6d5efc',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ]
})
