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

  createArcWheel(gHost, {
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
