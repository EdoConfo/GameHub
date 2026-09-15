import './styles.css'
import * as router from './router.js'
import * as storage from './shared/storage.js'
import * as players from './shared/players.js'
import * as table from './shared/table.js'
import * as stats from './shared/stats.js'
import { renderHub } from './hub/hub.js'
import { renderPlayer } from './hub/playerPage.js'
import { getGame } from './games/registry.js'
import { clear, el } from './shared/ui.js'
import { applyTheme, getTheme, watchSystem } from './shared/theme.js'

const root = document.getElementById('app')

// Block pinch-to-zoom (iOS Safari ignores user-scalable=no): stop gesture
// events and any multi-touch move. Double-tap zoom is handled by CSS
// touch-action: manipulation.
// App screens (hub, table) must never scroll or pan like a web page, and iOS
// doesn't always honour touch-action: stop the move itself. Only the drawer's
// own lists may scroll.
;['gesturestart', 'gesturechange', 'gestureend'].forEach(ev =>
  document.addEventListener(ev, e => e.preventDefault(), { passive: false }))
document.addEventListener('touchmove', e => {
  if (e.touches && e.touches.length > 1) { e.preventDefault(); return }
  const t = e.target
  if (t && t.closest && t.closest('.canvas') && !t.closest('.drawer-body, .pick-row')) e.preventDefault()
}, { passive: false })

// Paint in the chosen theme before any content shows. No choice yet means
// following the system, so a fresh install matches the phone.
applyTheme(getTheme())
watchSystem()

// Shared services handed to every game. Word packs are NOT here: each game
// owns and manages its own packs (see games/<id>/packs.js).
const ctx = { storage, players, table, stats, router, root, applyTheme }

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

// Hub opened on a game's table ("Gioca"), e.g. back from a match.
router.on('/table/:id', ({ id }) => {
  leaveCurrent()
  clear(root)
  renderHub(root, ctx, id, { table: true })
})

// Giocatori and Impostazioni are not separate screens: they're the left arc of
// circle A. These routes open the hub already parked there, so coming back from
// a player's page lands on the wheel it was opened from.
router.on('/settings', () => {
  leaveCurrent()
  clear(root)
  renderHub(root, ctx, null, { side: 'settings' })
})

// Same arc, centred on one setting — where changing the language comes back to.
router.on('/settings/:focus', ({ focus }) => {
  leaveCurrent()
  clear(root)
  renderHub(root, ctx, null, { side: 'settings', focusId: focus })
})

router.on('/players', () => {
  leaveCurrent()
  clear(root)
  renderHub(root, ctx, null, { side: 'players' })
})

// Same wheel, centred on the player you just came back from.
router.on('/players/:id', ({ id }) => {
  leaveCurrent()
  clear(root)
  renderHub(root, ctx, null, { side: 'players', focusId: id })
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
