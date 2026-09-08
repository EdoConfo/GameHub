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

router.on('/', () => {
  clear(root)
  renderHub(root, ctx)
})

router.on('/settings', () => {
  clear(root)
  renderSettings(root, ctx)
})

router.on('/game/:id', ({ id }) => {
  const game = getGame(id)
  clear(root)
  if (!game) return router.go('/')
  const container = el('div', { class: 'game-root' })
  root.append(container)
  game.mount(container, ctx)
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
