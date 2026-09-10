import { el, icon } from '../shared/ui.js'
import { createArcWheel } from '../shared/arcWheel.js'
import { createGameShell } from '../shared/gameShell.js'
import { games } from '../games/registry.js'

// One horizontal canvas. Depth 0 = games wheel. Depth 1 = a game "shell"
// (fixed circle + persistent header + menu/content lanes). Selecting a game
// slides to its shell; the shell handles menu <-> voice internally.
export function renderHub(root, ctx, startMenuId) {
  const canvas = el('div', { class: 'canvas' })
  const track = el('div', { class: 'canvas-track' })
  canvas.append(track)
  root.append(canvas)

  let depth = 0
  let shell = null
  const setDepth = i => { depth = i; track.style.setProperty('--i', String(i)) }

  // ---- depth 0: games wheel ----
  const gamesPanel = el('div', { class: 'canvas-page' })
  const gp = el('div', { class: 'hub' })
  gp.append(el('div', { class: 'hub-header' }, [
    el('span', { class: 'wordmark' }, 'GAMEHUB'),
    el('div', { class: 'hub-header-actions' }, [
      el('button', { class: 'icon-btn', 'aria-label': 'Giocatori', onclick: () => ctx.router.go('/players') }, icon('players')),
      el('button', { class: 'icon-btn', 'aria-label': 'Impostazioni', onclick: () => ctx.router.go('/settings') }, icon('settings'))
    ])
  ]))
  const gHost = el('div', { class: 'arc-host' })
  gp.append(gHost)
  gp.append(el('div', { class: 'hub-hint' }, 'scorri per scegliere · tocca per aprire'))
  gamesPanel.append(gp)
  track.append(gamesPanel)

  const gamesWheel = createArcWheel(gHost, {
    side: 'left',
    items: games.map(g => ({ title: g.name, sub: g.description })),
    onActivate: i => openGame(i)
  })

  function openGame(i) {
    teardownShell()
    shell = createGameShell(games[i], ctx, { onExit: () => backToGames() })
    track.append(shell.node)
    requestAnimationFrame(() => setDepth(1))
  }

  function backToGames() {
    setDepth(0)
    setTimeout(teardownShell, 660)
  }

  function teardownShell() {
    if (shell) { try { shell.destroy() } catch {} shell.node.remove(); shell = null }
  }

  // ---- horizontal swipe ----
  let sx = 0, sy = 0, tracking = false, hSwipe = false
  canvas.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; tracking = true; hSwipe = false }, true)
  canvas.addEventListener('pointermove', e => {
    if (!tracking || hSwipe) return
    const dx = e.clientX - sx, dy = e.clientY - sy
    if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.3) hSwipe = true
  }, true)
  canvas.addEventListener('pointerup', e => {
    if (!tracking) return
    tracking = false
    if (!hSwipe) return
    const dx = e.clientX - sx
    if (dx > 55) { if (depth === 1 && shell) shell.back() }        // right = back a level
    else if (dx < -55) {                                            // left = go deeper
      if (depth === 0) openGame(gamesWheel.getActive())
      else if (shell && shell.atMenu()) shell.openActive()
    }
  }, true)
  canvas.addEventListener('click', e => { if (hSwipe) { e.stopPropagation(); e.preventDefault(); hSwipe = false } }, true)

  // Deep entry straight into a game (old /menu/:id links).
  if (startMenuId) {
    const idx = games.findIndex(g => g.id === startMenuId)
    if (idx >= 0) {
      track.classList.add('no-anim')
      openGame(idx)
      requestAnimationFrame(() => { setDepth(1); requestAnimationFrame(() => track.classList.remove('no-anim')) })
    }
  }
}
