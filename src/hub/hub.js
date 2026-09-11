import { el, icon } from '../shared/ui.js'
import { createArcWheel } from '../shared/arcWheel.js'
import { openProfileEditor, avatar } from './players.js'
import { games } from '../games/registry.js'

// The hub is a fixed scene with TWO still circles; the app is a window panning
// across it. Nothing rotates or drifts on its own: circles and the labels that
// ride them live in the same world and move together, 1:1 with the camera.
//
//   circle A: left arc = Giocatori / Impostazioni · right arc = GIOCHI
//   circle B: left arc = menu del gioco           · right arc = (libero)
//
// Header and hint are not part of the scene: they stay put and swap content.
const V_SIDE = 0, V_GAMES = 1, V_MENU = 2

// A line icon in a round badge that sits on the circle like a bead.
const badge = name => el('span', { class: 'arc-badge' }, icon(name))

export function renderHub(root, ctx, startMenuId) {
  let index = V_GAMES
  let selected = 0
  let sideKind = 'players'
  let world = { W: 0, H: 0, R: 0, xA: 0, xB: 0, cam: [0, 0, 0], width: 0 }

  const canvas = el('div', { class: 'canvas' })
  const scene = el('div', { class: 'world' })
  canvas.append(scene)

  const SVGNS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(SVGNS, 'svg')
  svg.setAttribute('class', 'world-circles')
  const circleA = document.createElementNS(SVGNS, 'circle')
  const circleB = document.createElementNS(SVGNS, 'circle')
  circleA.setAttribute('class', 'arc-line')
  circleB.setAttribute('class', 'arc-line')
  svg.append(circleA, circleB)
  scene.append(svg)

  // One host per view: a window-sized box parked at that view's camera spot.
  const hosts = [0, 1, 2].map(() => {
    const h = el('div', { class: 'arc-host' })
    scene.append(h)
    return h
  })

  const header = el('div', { class: 'hub-header' })
  const hint = el('div', { class: 'hub-hint' })
  canvas.append(header, hint)
  root.append(canvas)

  // ---- scene geometry ----
  function measure() {
    const r = canvas.getBoundingClientRect()
    if (!r.width || !r.height) return false
    const W = r.width, H = r.height
    const R = H * 0.5                 // circles touch the top and bottom edges
    const xA = R + 0.76 * W           // puts the leftmost view at world 0
    const xB = xA + 2 * R + 0.9 * W   // close enough that an arc is always in sight
    world = { W, H, R, xA, xB, cam: [0, 2 * R + 0.52 * W, 2 * R + 0.9 * W], width: xB + R + W }
    return true
  }

  function layout(animate = false) {
    if (!measure()) return
    const { W, H, R, xA, xB, cam, width } = world
    svg.setAttribute('width', String(width))
    svg.setAttribute('height', String(H))
    for (const [c, x] of [[circleA, xA], [circleB, xB]]) {
      c.setAttribute('cx', String(x)); c.setAttribute('cy', String(H / 2)); c.setAttribute('r', String(R))
    }
    hosts.forEach((h, i) => { h.style.left = cam[i] + 'px'; h.style.width = W + 'px' })
    moveCamera(index, animate)
  }

  function moveCamera(i, animate = true) {
    const from = world.cam[index]
    index = Math.max(0, Math.min(2, i))
    const to = world.cam[index]
    // constant-ish speed: crossing a circle takes longer than hopping to the next
    const dist = Math.abs(to - from)
    const secs = Math.min(0.8, Math.max(0.34, 0.6 * Math.sqrt(dist / 1000)))
    scene.style.transitionDuration = animate ? secs + 's' : '0s'
    hosts.forEach((h, k) => {
      h.style.transitionDuration = animate ? secs + 's' : '0s'
      h.classList.toggle('here', k === index)
    })
    scene.style.transform = `translateX(${-to}px)`
    renderHeader()
    if (!animate) requestAnimationFrame(() => {
      scene.style.transitionDuration = ''
      hosts.forEach(h => { h.style.transitionDuration = '' })
    })
  }

  function goto(i) {
    if (i === V_MENU) { selected = gamesWheel.getActive(); buildMenu() }
    if (i === V_SIDE) buildSide(sideKind)
    moveCamera(i)
  }

  // ---- header (fixed, swaps with the view) ----
  function renderHeader() {
    if (index === V_GAMES) {
      header.replaceChildren(
        el('span', { class: 'wordmark' }, 'GAMEHUB'),
        el('div', { class: 'hub-header-actions' }, [
          el('button', { class: 'icon-btn', 'aria-label': 'Giocatori', onclick: () => { buildSide('players'); moveCamera(V_SIDE) } }, icon('players')),
          el('button', { class: 'icon-btn', 'aria-label': 'Impostazioni', onclick: () => { buildSide('settings'); moveCamera(V_SIDE) } }, icon('settings'))
        ])
      )
      hint.textContent = 'scorri per scegliere · tocca per aprire'
    } else if (index === V_MENU) {
      // page on the right of its circle: back arrow left, name right
      header.replaceChildren(
        el('button', { class: 'icon-btn', 'aria-label': 'Indietro', onclick: () => goto(V_GAMES) }, icon('back')),
        el('span', { class: 'wordmark game-home-title' }, games[selected].name.toUpperCase())
      )
      hint.textContent = 'scorri per scegliere · tocca per aprire'
    } else {
      // page on the left of its circle: mirrored — name left, arrow right
      header.replaceChildren(
        el('span', { class: 'wordmark game-home-title' }, sideKind === 'settings' ? 'IMPOSTAZIONI' : 'GIOCATORI'),
        el('button', { class: 'icon-btn', 'aria-label': 'Indietro', onclick: () => goto(V_GAMES) }, icon('forward'))
      )
      hint.textContent = 'tocca per aprire'
    }
  }

  // ---- circle A, left arc: Giocatori / Impostazioni ----
  function buildSide(kind) {
    sideKind = kind
    hosts[V_SIDE].replaceChildren()
    if (kind === 'settings') {
      const dark = ctx.storage.get('theme', 'dark') !== 'light'
      createArcWheel(hosts[V_SIDE], {
        side: 'right',
        items: [
          { title: 'Tema', sub: dark ? 'Scuro' : 'Chiaro', lead: badge(dark ? 'moon' : 'sun') },
          { title: 'Offline', sub: 'Installabile · funziona senza rete', lead: badge('offline') }
        ],
        onActivate: i => { if (i === 0) { ctx.applyTheme(dark ? 'light' : 'dark'); buildSide('settings'); renderHeader() } }
      })
    } else {
      const list = ctx.players.all()
      const items = list.map(p => ({ title: p.name, sub: 'Profilo', lead: avatar(p, 56) }))
      items.push({ title: 'Nuovo', sub: 'Aggiungi giocatore', lead: badge('plus') })
      createArcWheel(hosts[V_SIDE], {
        side: 'right',
        items,
        onActivate: i => {
          if (i < list.length) ctx.router.go('/player/' + list[i].id)
          else openProfileEditor(ctx, null, () => { buildSide('players'); renderHeader() })
        }
      })
    }
    renderHeader()
  }

  // ---- circle A, right arc: GIOCHI ----
  const gamesWheel = createArcWheel(hosts[V_GAMES], {
    side: 'left',
    items: games.map(g => ({ title: g.name, sub: g.description, lead: badge(g.glyph || 'play') })),
    onActivate: () => goto(V_MENU)
  })

  // ---- circle B, left arc: menu del gioco ----
  function buildMenu() {
    const game = games[selected]
    hosts[V_MENU].replaceChildren()
    const menu = game.menu || []
    createArcWheel(hosts[V_MENU], {
      side: 'right',
      items: menu.map(m => ({ title: m.title, sub: m.sub, lead: badge(m.glyph || 'play') })),
      onActivate: j => ctx.router.go('/game/' + game.id + '/' + menu[j].phase)
    })
  }

  buildSide('players')
  buildMenu()

  // ---- horizontal swipe pans the window ----
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

  const ro = new ResizeObserver(() => { if (!canvas.isConnected) { ro.disconnect(); return } layout(false) })
  ro.observe(canvas)

  if (startMenuId) {
    const i = games.findIndex(g => g.id === startMenuId)
    if (i >= 0) { gamesWheel.setActive(i); selected = i; buildMenu(); index = V_MENU }
  }
  layout(false)
  requestAnimationFrame(() => layout(false))
}
