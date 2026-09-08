import './styles.css'
import * as router from './router.js'
import * as storage from './shared/storage.js'
import * as players from './shared/players.js'
import * as packs from './shared/packs.js'
import { renderHub } from './hub/hub.js'
import { renderSettings } from './hub/settings.js'
import { getGame } from './games/registry.js'
import { clear, screen, el } from './shared/ui.js'

const root = document.getElementById('app')

// Apply persisted theme before first paint of content.
applyTheme(storage.get('theme', 'dark'))

// Shared services handed to every game.
const ctx = { storage, players, packs, router, root, applyTheme }

// A mounted game may return a cleanup fn (stop timers/sensors). Call it
// whenever we leave the current screen.
let currentCleanup = null
function leaveCurrent() {
  if (typeof currentCleanup === 'function') currentCleanup()
  currentCleanup = null
}

router.on('/', () => {
  leaveCurrent()
  clear(root)
  renderHub(root, ctx)
})

router.on('/settings', () => {
  leaveCurrent()
  clear(root)
  renderSettings(root, ctx)
})

router.on('/game/:id', ({ id }) => {
  leaveCurrent()
  const game = getGame(id)
  clear(root)
  if (!game) return router.go('/')
  const container = el('div', { class: 'game-root' })
  root.append(container)
  currentCleanup = game.mount(container, ctx) || null
})

router.setNotFound(() => router.go('/'))

router.start()

export function applyTheme(theme) {
  const t = theme === 'light' ? 'light' : 'dark'
  document.documentElement.dataset.theme = t
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', t === 'light' ? '#f4f4fb' : '#0f1020')
  storage.set('theme', t)
}
