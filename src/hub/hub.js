import { el, icon } from '../shared/ui.js'
import { createArcWheel } from '../shared/arcWheel.js'
import { games } from '../games/registry.js'

// The hub is one horizontal canvas with two pages side by side:
//   page 0 = the games wheel (circle on the left)
//   page 1 = the selected game's menu wheel (mirrored circle on the right)
// Picking a game slides the canvas left, revealing that game's menu as if it
// were already there. `startMenuId` opens straight on a game's menu page.
export function renderHub(root, ctx, startMenuId) {
  const canvas = el('div', { class: 'canvas' })
  const track = el('div', { class: 'canvas-track' })
  const pageGames = el('div', { class: 'canvas-page' })
  const pageMenu = el('div', { class: 'canvas-page' })
  track.append(pageGames, pageMenu)
  canvas.append(track)
  root.append(canvas)

  // ---- Games page ----
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
  pageGames.append(gp)

  const gamesWheel = createArcWheel(gHost, {
    side: 'left',
    items: games.map(g => ({ title: g.name, sub: g.description })),
    onActivate: i => showMenu(i)
  })

  // ---- Menu page (rebuilt for the selected game) ----
  function buildMenu(i) {
    const game = games[i]
    pageMenu.replaceChildren()
    const mp = el('div', { class: 'hub' })
    mp.append(el('div', { class: 'hub-header' }, [
      el('button', { class: 'icon-btn', 'aria-label': 'Indietro', onclick: toGames }, icon('back')),
      el('span', { class: 'wordmark game-home-title' }, game.name.toUpperCase())
    ]))
    const mHost = el('div', { class: 'arc-host' })
    mp.append(mHost)
    mp.append(el('div', { class: 'hub-hint' }, 'scorri per scegliere · tocca per aprire'))
    pageMenu.append(mp)

    const menu = game.menu || []
    createArcWheel(mHost, {
      side: 'right',
      items: menu.map(m => ({ title: m.title, sub: m.sub })),
      onActivate: e => ctx.router.go('/game/' + game.id + '/' + menu[e].phase)
    })
  }

  function showMenu(i) { buildMenu(i); track.classList.add('at-menu') }
  function toGames() { track.classList.remove('at-menu') }
  function atMenu() { return track.classList.contains('at-menu') }

  // Horizontal swipe to pan pages (vertical gestures stay with the wheels).
  // Capture phase so we can veto the click a horizontal swipe would trigger.
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
    if (dx > 55 && atMenu()) toGames()
    else if (dx < -55 && !atMenu()) showMenu(gamesWheel.getActive())
  }, true)
  // Swallow the click a swipe would otherwise fire on a wheel item.
  canvas.addEventListener('click', e => { if (hSwipe) { e.stopPropagation(); e.preventDefault(); hSwipe = false } }, true)

  // Opened directly on a game's menu (e.g. back from a game screen): show it
  // without the slide animation.
  if (startMenuId) {
    const idx = games.findIndex(g => g.id === startMenuId)
    if (idx >= 0) {
      buildMenu(idx)
      track.classList.add('no-anim', 'at-menu')
      requestAnimationFrame(() => track.classList.remove('no-anim'))
    }
  }
}
