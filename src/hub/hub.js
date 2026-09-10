import { el, icon } from '../shared/ui.js'
import { createArcWheel, arcGeometry } from '../shared/arcWheel.js'
import { openProfileEditor } from './players.js'
import { games } from '../games/registry.js'

// The hub is a strip of three circles, symmetric around the games one:
//
//   [ Giocatori / Impostazioni ] [ GIOCHI ] [ Menu del gioco ]
//            circle right         left            right
//
// From the games circle you cross the circle either way: tap a game and it
// slides left while the game's circle sweeps in from the right; tap giocatori
// or impostazioni and it slides right while that circle sweeps in from the
// left. Both side pages share one slot, so you never fly past a page.
const P_SIDE = 0, P_GAMES = 1, P_MENU = 2

export function renderHub(root, ctx, startMenuId) {
  let index = P_GAMES
  let selected = 0
  let sideKind = 'players'

  const canvas = el('div', { class: 'canvas' })

  // ONE circle for the whole hub, drawn above the strip and slid on its own.
  // At rest it lands exactly on the active page's arc; while you move between
  // pages its centre crosses the screen, so you see the whole circle go by.
  const SVGNS = 'http://www.w3.org/2000/svg'
  const circleSvg = document.createElementNS(SVGNS, 'svg')
  circleSvg.setAttribute('class', 'hub-circle')
  const circleEl = document.createElementNS(SVGNS, 'circle')
  circleEl.setAttribute('class', 'arc-line')
  circleSvg.append(circleEl)
  canvas.append(circleSvg)

  const track = el('div', { class: 'canvas-track' })
  canvas.append(track)
  root.append(canvas)

  // side of the circle for each page: games hugs the left, its neighbours mirror
  const sideOf = i => (i === P_GAMES ? 'left' : 'right')
  let circleShift = 0

  function layoutCircle(animate = true) {
    const r = canvas.getBoundingClientRect()
    if (!r.width || !r.height) return
    const base = arcGeometry(r.width, r.height, 'left')
    const mirrored = arcGeometry(r.width, r.height, 'right')
    circleEl.setAttribute('cx', String(base.Cx))
    circleEl.setAttribute('cy', String(base.Cy))
    circleEl.setAttribute('r', String(base.R))
    circleShift = mirrored.Cx - base.Cx
    if (!animate) circleSvg.classList.add('no-anim')
    circleSvg.style.transform = `translateX(${sideOf(index) === 'left' ? 0 : circleShift}px)`
    if (!animate) requestAnimationFrame(() => circleSvg.classList.remove('no-anim'))
  }

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
  }
  makePage(P_SIDE, 'tocca per aprire')
  makePage(P_GAMES, 'scorri per scegliere · tocca per aprire')
  makePage(P_MENU, 'scorri per scegliere · tocca per aprire')

  function setIndex(i, animate = true) {
    index = Math.max(0, Math.min(pages.length - 1, i))
    if (!animate) track.classList.add('no-anim')
    track.style.setProperty('--i', String(index))
    if (!animate) requestAnimationFrame(() => track.classList.remove('no-anim'))
    layoutCircle(animate)
  }

  function goto(i) {
    if (i === P_MENU) { selected = gamesWheel.getActive(); buildMenu() }
    if (i === P_SIDE) buildSide(sideKind)
    setIndex(i)
  }

  // Header for a page on the RIGHT of games: back arrow left, name right.
  const headerRight = label => [
    el('button', { class: 'icon-btn', 'aria-label': 'Indietro', onclick: () => goto(P_GAMES) }, icon('back')),
    el('span', { class: 'wordmark game-home-title' }, label)
  ]
  // Mirrored header for the page on the LEFT of games: name left, arrow right.
  const headerLeft = label => [
    el('span', { class: 'wordmark game-home-title' }, label),
    el('button', { class: 'icon-btn', 'aria-label': 'Indietro', onclick: () => goto(P_GAMES) }, icon('forward'))
  ]

  // ---- Side circle: Giocatori or Impostazioni (same slot) ----
  function buildSide(kind) {
    sideKind = kind
    const { header, host } = pages[P_SIDE]
    host.replaceChildren()
    if (kind === 'settings') {
      header.replaceChildren(...headerLeft('IMPOSTAZIONI'))
      const dark = ctx.storage.get('theme', 'dark') !== 'light'
      createArcWheel(host, {
        side: 'right',
        items: [
          { title: 'Tema', sub: dark ? 'Scuro' : 'Chiaro' },
          { title: 'Offline', sub: 'Installabile · funziona senza rete' }
        ],
        onActivate: i => { if (i === 0) { ctx.applyTheme(dark ? 'light' : 'dark'); buildSide('settings') } }
      })
    } else {
      header.replaceChildren(...headerLeft('GIOCATORI'))
      const list = ctx.players.all()
      const items = list.map(p => ({ title: p.name, sub: 'Profilo' }))
      items.push({ title: 'Nuovo', sub: 'Aggiungi giocatore' })
      createArcWheel(host, {
        side: 'right',
        items,
        onActivate: i => {
          if (i < list.length) ctx.router.go('/player/' + list[i].id)
          else openProfileEditor(ctx, null, () => buildSide('players'))
        }
      })
    }
  }

  // ---- Games circle ----
  pages[P_GAMES].header.replaceChildren(
    el('span', { class: 'wordmark' }, 'GAMEHUB'),
    el('div', { class: 'hub-header-actions' }, [
      el('button', { class: 'icon-btn', 'aria-label': 'Giocatori', onclick: () => { buildSide('players'); setIndex(P_SIDE) } }, icon('players')),
      el('button', { class: 'icon-btn', 'aria-label': 'Impostazioni', onclick: () => { buildSide('settings'); setIndex(P_SIDE) } }, icon('settings'))
    ])
  )
  const gamesWheel = createArcWheel(pages[P_GAMES].host, {
    side: 'left',
    items: games.map(g => ({ title: g.name, sub: g.description })),
    onActivate: () => goto(P_MENU)
  })

  // ---- Game menu circle ----
  function buildMenu() {
    const game = games[selected]
    pages[P_MENU].header.replaceChildren(...headerRight(game.name.toUpperCase()))
    const host = pages[P_MENU].host
    host.replaceChildren()
    const menu = game.menu || []
    createArcWheel(host, {
      side: 'right',
      items: menu.map(m => ({ title: m.title, sub: m.sub })),
      onActivate: j => ctx.router.go('/game/' + game.id + '/' + menu[j].phase)
    })
  }

  buildSide('players')
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

  const ro = new ResizeObserver(() => {
    if (!canvas.isConnected) { ro.disconnect(); return }
    layoutCircle(false)
  })
  ro.observe(canvas)
  requestAnimationFrame(() => layoutCircle(false))

  // Start on games, or straight on a game's menu (back from a game screen).
  if (startMenuId) {
    const i = games.findIndex(g => g.id === startMenuId)
    if (i >= 0) {
      gamesWheel.setActive(i)
      selected = i
      buildMenu()
      setIndex(P_MENU, false)
      return
    }
  }
  setIndex(P_GAMES, false)
}
