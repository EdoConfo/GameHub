import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'

// Which build this is, readable from inside the app (Impostazioni). Without it,
// "is my phone on the new version?" can only be guessed at. Git is asked first:
// the deploy builds two branches in one run, and the commit CI hands over is
// only the one that was pushed. A checkout without git falls back on that, and
// then on just "dev".
function buildId() {
  try { return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() }
  catch { return process.env.GITHUB_SHA ? process.env.GITHUB_SHA.slice(0, 7) : 'dev' }
}

// Two sites from one repo: `main` is the real one, `dev` is where a change is
// tried on a phone before it goes there. The deploy builds each branch and
// serves dev in a folder of the real site (.github/workflows/deploy.yml).
const CHANNEL = process.env.GAMEHUB_CHANNEL === 'dev' ? 'dev' : 'prod'
const DEV = CHANNEL === 'dev'

// IMPORTANT: base path must match the GitHub repo name for GitHub Pages.
// Repo: https://github.com/EdoConfo/GameHub  ->  site served at /GameHub/
// If you rename the repo, change ROOT here (keep the leading and trailing slash).
const ROOT = '/GameHub/'
const BASE = DEV ? ROOT + 'dev/' : ROOT

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
  define: { __BUILD__: JSON.stringify(BUILD), __CHANNEL__: JSON.stringify(CHANNEL) },
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
        // Precache everything the build emits. No words among it any more —
        // both games download theirs — but the pattern stays as it is: it
        // describes the build, not what happens to be in it this week.
        globPatterns: ['**/*.{js,css,html,svg,png,json,woff2}'],
        // never from the cache: it's the one file that has to say what's live
        globIgnores: ['**/version.json'],
        navigateFallback: BASE + 'index.html',
        // The real site's worker covers every address under it, dev's folder
        // included: without this, a phone with the real app installed would be
        // handed the real app every time it opened the dev one.
        navigateFallbackDenylist: DEV ? [] : [new RegExp('^' + ROOT + 'dev/')]
      },
      manifest: {
        // its own name and id, so both can sit on the Home screen side by side
        id: BASE,
        name: DEV ? 'GameHub Dev' : 'GameHub',
        short_name: DEV ? 'GameHub Dev' : 'GameHub',
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
