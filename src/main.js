import './styles.css'
import * as router from './router.js'
import * as storage from './shared/storage.js'
import * as players from './shared/players.js'
import * as stats from './shared/stats.js'
import { renderHub } from './hub/hub.js'
import { renderSettings } from './hub/settings.js'
import { renderPlayers } from './hub/players.js'
import { renderPlayer } from './hub/playerPage.js'
import { getGame } from './games/registry.js'
import { clear, screen, el } from './shared/ui.js'

const root = document.getElementById('app')

// Block pinch-to-zoom (iOS Safari ignores user-scalable=no): stop gesture
// events and any multi-touch move. Double-tap zoom is handled by CSS
// touch-action: manipulation.
;['gesturestart', 'gesturechange', 'gestureend'].forEach(ev =>
  document.addEventListener(ev, e => e.preventDefault(), { passive: false }))
document.addEventListener('touchmove', e => {
  if (e.touches && e.touches.length > 1) e.preventDefault()
}, { passive: false })

// Apply persisted theme before first paint of content.
applyTheme(storage.get('theme', 'dark'))

// Shared services handed to every game. Word packs are NOT here: each game
// owns and manages its own packs (see games/<id>/packs.js).
const ctx = { storage, players, stats, router, root, applyTheme }

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

// Hub opened straight on a game's menu page (e.g. back from a game screen).
router.on('/menu/:id', ({ id }) => {
  leaveCurrent()
  clear(root)
  renderHub(root, ctx, id)
})

router.on('/settings', () => {
  leaveCurrent()
  clear(root)
  renderSettings(root, ctx)
})

router.on('/players', () => {
  leaveCurrent()
  clear(root)
  renderPlayers(root, ctx)
})

router.on('/player/:id', ({ id }) => {
  leaveCurrent()
  renderPlayer(root, ctx, id)
})

function mountGame(id, phase) {
  leaveCurrent()
  const game = getGame(id)
  clear(root)
  if (!game) return router.go('/')
  const container = el('div', { class: 'game-root' })
  root.append(container)
  currentCleanup = game.mount(container, ctx, phase) || null
}
router.on('/game/:id/:phase', ({ id, phase }) => mountGame(id, phase))
router.on('/game/:id', ({ id }) => mountGame(id))

router.setNotFound(() => router.go('/'))

router.start()

export function applyTheme(theme) {
  const t = theme === 'light' ? 'light' : 'dark'
  document.documentElement.dataset.theme = t
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', t === 'light' ? '#eaecf7' : '#0a0b16')
  storage.set('theme', t)
}
