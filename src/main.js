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
  if (t && t.closest && t.closest('.canvas') && !t.closest('.drawer-body')) e.preventDefault()
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

// Giocatori and Impostazioni are not separate screens: they're the left arc of
// circle A. These routes open the hub already parked there.
router.on('/players', () => {
  leaveCurrent()
  clear(root)
  renderHub(root, ctx, null, { side: 'players' })
})

router.on('/settings', () => {
  leaveCurrent()
  clear(root)
  renderHub(root, ctx, null, { side: 'settings' })
})

// A player's own page.
router.on('/players/:id', ({ id }) => {
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

// From here on the first piece is a game. Keep these last: whatever isn't one
// of the fixed routes above is read as a game id.
//
// The hub owns the menu and the table — they're views of its scene, not
// screens of their own — so those two go to renderHub, not to the game.
// The word packs and the rules are views of the hub's scene too — the same
// right arc of that game's circle, showing one or the other — so they go to
// renderHub, like the menu and the table.
for (const kind of ['words', 'rules']) {
  router.on('/:game/' + kind, ({ game }) => {
    leaveCurrent()
    clear(root)
    renderHub(root, ctx, game, { gameSide: kind })
  })
}

router.on('/:game/table', ({ game }) => {
  leaveCurrent()
  clear(root)
  renderHub(root, ctx, game, { table: true })
})

router.on('/:game/:phase', ({ game, phase }) => mountGame(game, phase))

router.on('/:game', ({ game }) => {
  leaveCurrent()
  clear(root)
  renderHub(root, ctx, game)
})

router.setNotFound(() => router.go('/'))

router.start()
