import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'

// Which build this is, readable from inside the app (Impostazioni). Without it,
// "is my phone on the new version?" can only be guessed at. In CI the commit is
// handed to us; locally we ask git, and a checkout without git is just "dev".
function buildId() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7)
  try { return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() }
  catch { return 'dev' }
}

// IMPORTANT: base path must match the GitHub repo name for GitHub Pages.
// Repo: https://github.com/EdoConfo/GameHub  ->  site served at /GameHub/
// If you rename the repo, change BASE here (keep the leading and trailing slash).
const BASE = '/GameHub/'

// Publishes version.json next to the app: the build this deploy is. The app
// polls it (see src/shared/update.js) to notice a new deploy while it's open,
// without waiting for the service worker's own, much lazier, check.
const BUILD = buildId()
function versionFile() {
  return {
    name: 'gamehub-version',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD }) })
    }
  }
}

export default defineConfig({
  base: BASE,
  define: { __BUILD__: JSON.stringify(BUILD) },
  // Always the same address (bookmarked on the phone): if 5173 is taken,
  // fail loudly instead of quietly moving to 5174.
  server: { port: 5173, strictPort: true },
  plugins: [
    versionFile(),
    VitePWA({
      // The new version waits instead of taking over: the app offers it with a
      // button, outside a match, because a reload mid-round loses the roles that
      // were dealt. src/shared/update.js does the asking.
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png'],
      workbox: {
        // Precache everything the build emits, including bundled word-pack JSON.
        globPatterns: ['**/*.{js,css,html,svg,png,json,woff2}'],
        // never from the cache: it's the one file that has to say what's live
        globIgnores: ['**/version.json'],
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
        background_color: '#0f1117',
        theme_color: '#0f1117',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ]
})
