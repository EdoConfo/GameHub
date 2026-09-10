import { el, icon } from '../shared/ui.js'
import { createArcWheel } from '../shared/arcWheel.js'
import { openProfileEditor } from './players.js'
import { games } from '../games/registry.js'

// The hub is a horizontal strip of CIRCLES. Each page is its own circle stuck
// to one edge of the screen, with its items riding the visible arc; adjacent
// circles are mirrored so their arcs face each other.
//
//   [ Impostazioni ] [ Giocatori ] [ GIOCHI ] [ Menu del gioco ]
//          left          right       left          right
//
// From the games circle: tap a game -> it slides left and the game's circle
// comes in from the right. Tap giocatori/impostazioni -> it slides right and
// that circle comes in from the left. Room to grow on both ends.
const P_SETTINGS = 0, P_PLAYERS = 1, P_GAMES = 2, P_MENU = 3
const SIDE = i => (i % 2 === 0 ? 'left' : 'right')

export function renderHub(root, ctx, startMenuId) {
  let index = P_GAMES
  let selected = 0

  const canvas = el('div', { class: 'canvas' })
  const track = el('div', { class: 'canvas-track' })
  canvas.append(track)
  root.append(canvas)

  const pages = []
  function makePage(i, hint) {
    const page = el('div', { class: 'canvas-page' })
    const hub = el('div', { class: 'hub' })
    const header = el('div', { class: 'hub-header' })
    const host = el('div', { class: 'arc-host' })
    hub.append(header, host, el('div', { class: 'hub-hint' }, hint))
    page.append(hub)
    track.append(page)
    pages[i] = { page, header, host }
    return pages[i]
  }

  makePage(P_SETTINGS, 'tocca per cambiare')
  makePage(P_PLAYERS, 'tocca per aprire')
  makePage(P_GAMES, 'scorri per scegliere · tocca per aprire')
  makePage(P_MENU, 'scorri per scegliere · tocca per aprire')

  function goto(i) {
    const target = Math.max(0, Math.min(pages.length - 1, i))
    if (target === P_MENU) { selected = gamesWheel.getActive(); buildMenu() }
    index = target
    track.style.setProperty('--i', String(target))
  }

  const backTo = (i, label) => [
    el('button', { class: 'icon-btn', 'aria-label': 'Indietro', onclick: () => goto(i) }, icon('back')),
    el('span', { class: 'wordmark game-home-title' }, label)
  ]

  // ---- Impostazioni ----
  function buildSettings() {
    pages[P_SETTINGS].header.replaceChildren(...backTo(P_GAMES, 'IMPOSTAZIONI'))
    const host = pages[P_SETTINGS].host
    host.replaceChildren()
    const dark = ctx.storage.get('theme', 'dark') !== 'light'
    createArcWheel(host, {
      side: SIDE(P_SETTINGS),
      items: [
        { title: 'Tema', sub: dark ? 'Scuro' : 'Chiaro' },
        { title: 'Offline', sub: 'Installabile · funziona senza rete' }
      ],
      onActivate: i => { if (i === 0) { ctx.applyTheme(dark ? 'light' : 'dark'); buildSettings() } }
    })
  }

  // ---- Giocatori ----
  function buildPlayers() {
    pages[P_PLAYERS].header.replaceChildren(...backTo(P_GAMES, 'GIOCATORI'))
    const host = pages[P_PLAYERS].host
    host.replaceChildren()
    const list = ctx.players.all()
    const items = list.map(p => ({ title: p.name, sub: 'Profilo' }))
    items.push({ title: 'Nuovo', sub: 'Aggiungi giocatore' })
    createArcWheel(host, {
      side: SIDE(P_PLAYERS),
      items,
      onActivate: i => {
        if (i < list.length) ctx.router.go('/player/' + list[i].id)
        else openProfileEditor(ctx, null, () => buildPlayers())
      }
    })
  }

  // ---- Giochi ----
  pages[P_GAMES].header.replaceChildren(
    el('span', { class: 'wordmark' }, 'GAMEHUB'),
    el('div', { class: 'hub-header-actions' }, [
      el('button', { class: 'icon-btn', 'aria-label': 'Giocatori', onclick: () => goto(P_PLAYERS) }, icon('players')),
      el('button', { class: 'icon-btn', 'aria-label': 'Impostazioni', onclick: () => goto(P_SETTINGS) }, icon('settings'))
    ])
  )
  const gamesWheel = createArcWheel(pages[P_GAMES].host, {
    side: SIDE(P_GAMES),
    items: games.map(g => ({ title: g.name, sub: g.description })),
    onActivate: () => goto(P_MENU)
  })

  // ---- Menu del gioco ----
  function buildMenu() {
    const game = games[selected]
    pages[P_MENU].header.replaceChildren(...backTo(P_GAMES, game.name.toUpperCase()))
    const host = pages[P_MENU].host
    host.replaceChildren()
    const menu = game.menu || []
    createArcWheel(host, {
      side: SIDE(P_MENU),
      items: menu.map(m => ({ title: m.title, sub: m.sub })),
      onActivate: j => ctx.router.go('/game/' + game.id + '/' + menu[j].phase)
    })
  }

  buildSettings()
  buildPlayers()
  buildMenu()

  // ---- horizontal swipe between circles ----
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
    if (dx > 55) goto(index - 1)
    else if (dx < -55) goto(index + 1)
  }, true)
  canvas.addEventListener('click', e => { if (hSwipe) { e.stopPropagation(); e.preventDefault(); hSwipe = false } }, true)

  // Start on the games circle, or straight on a game's menu (back from a game).
  if (startMenuId) {
    const idx = games.findIndex(g => g.id === startMenuId)
    if (idx >= 0) {
      gamesWheel.setActive(idx)
      selected = idx
      buildMenu()
      track.classList.add('no-anim')
      track.style.setProperty('--i', String(P_MENU))
      index = P_MENU
      requestAnimationFrame(() => track.classList.remove('no-anim'))
      return
    }
  }
  track.style.setProperty('--i', String(P_GAMES))
  track.classList.add('no-anim')
  requestAnimationFrame(() => track.classList.remove('no-anim'))
}
