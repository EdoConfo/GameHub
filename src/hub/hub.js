import { el, icon } from '../shared/ui.js'
import { games } from '../games/registry.js'

// ONE big circle (R = H/2, so it spans top→bottom). You only ever see one side:
//  - "games" view: the circle sits with its centre off to the RIGHT, its left
//    bulge on screen, the games riding that arc.
//  - pick a game and the whole circle SLIDES until it's mirrored: centre off to
//    the LEFT, right bulge on screen, the game's menu riding that arc.
// It's the same circle translating — not two circles.
export function renderHub(root, ctx) {
  let active = 0
  let view = 'games'
  const geom = { W: 0, H: 0, R: 0, cx: 0, cy: 0, txMenu: 0, step: 0.34 }

  const dial = el('div', { class: 'dial' })

  // A single group holding the circle + both arcs; it translates as a whole.
  const groupA = el('div', { class: 'dial-group' })
  const SVGNS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(SVGNS, 'svg')
  svg.setAttribute('class', 'dial-circle')
  const circle = document.createElementNS(SVGNS, 'circle')
  circle.setAttribute('class', 'arc-line')
  svg.append(circle)
  const gamesLayer = el('div', { class: 'dial-layer' })
  const menuLayer = el('div', { class: 'dial-layer' })
  groupA.append(svg, gamesLayer, menuLayer)
  dial.append(groupA)

  // Header changes with the view (games: wordmark + icons; menu: back + name).
  const header = el('div', { class: 'hub-header dial-header' })
  dial.append(header)
  dial.append(el('div', { class: 'hub-hint dial-hint' }, 'scorri per scegliere · tocca per aprire'))
  root.append(dial)

  function renderHeader() {
    header.replaceChildren()
    if (view === 'games') {
      header.append(
        el('span', { class: 'wordmark' }, 'GAMEHUB'),
        el('div', { class: 'hub-header-actions' }, [
          el('button', { class: 'icon-btn', 'aria-label': 'Giocatori', onclick: () => ctx.router.go('/players') }, icon('players')),
          el('button', { class: 'icon-btn', 'aria-label': 'Impostazioni', onclick: () => ctx.router.go('/settings') }, icon('settings'))
        ])
      )
    } else {
      header.append(
        el('button', { class: 'icon-btn', 'aria-label': 'Indietro', onclick: () => showGames() }, icon('back')),
        el('span', { class: 'wordmark game-home-title' }, games[active].name.toUpperCase())
      )
    }
  }

  // --- geometry ---
  function measure() {
    const r = dial.getBoundingClientRect()
    geom.W = r.width; geom.H = r.height
    geom.R = geom.H / 2
    geom.cy = geom.H / 2
    geom.cx = 0.28 * geom.W + geom.R          // left-bulge vertex at 0.28 W
    geom.txMenu = 0.44 * geom.W - 2 * geom.R  // shift so right bulge lands at 0.72 W
    circle.setAttribute('cx', String(geom.cx))
    circle.setAttribute('cy', String(geom.cy))
    circle.setAttribute('r', String(geom.R))
    svg.setAttribute('width', String(geom.cx + geom.R + geom.W))
    svg.setAttribute('height', String(geom.H))
  }

  function place(node, angle) {
    const x = geom.cx + geom.R * Math.cos(angle)
    const y = geom.cy + geom.R * Math.sin(angle)
    node.style.left = x + 'px'
    node.style.top = y + 'px'
  }

  function renderGames() {
    gamesLayer.replaceChildren()
    const n = games.length
    games.forEach((g, i) => {
      const a = Math.PI + (i - (n - 1) / 2) * geom.step // around 180° (left bulge)
      const item = el('button', {
        class: 'dial-item left' + (i === active ? ' on' : ''),
        onclick: () => pickGame(i)
      }, [
        el('span', { class: 'dial-num' }, String(i + 1).padStart(2, '0')),
        el('span', { class: 'dial-label' }, g.name)
      ])
      gamesLayer.append(item)
      place(item, a)
    })
  }

  function renderMenu() {
    menuLayer.replaceChildren()
    const menu = games[active].menu || []
    const m = menu.length
    menu.forEach((v, j) => {
      const a = (j - (m - 1) / 2) * geom.step // around 0° (right bulge)
      const item = el('button', {
        class: 'dial-item right',
        onclick: () => ctx.router.go('/game/' + games[active].id + '/' + v.phase)
      }, [el('span', { class: 'dial-label' }, v.title)])
      menuLayer.append(item)
      place(item, a)
    })
  }

  function setView(v) {
    view = v
    groupA.style.transform = `translateX(${v === 'menu' ? geom.txMenu : 0}px)`
    renderHeader()
  }
  function pickGame(i) { active = i; renderGames(); renderMenu(); setView('menu') }
  function showGames() { setView('games') }

  function layout() {
    measure()
    renderGames()
    renderMenu()
    // keep current view offset without animating on resize
    groupA.style.transform = `translateX(${view === 'menu' ? geom.txMenu : 0}px)`
  }
  const ro = new ResizeObserver(() => { if (!dial.isConnected) { ro.disconnect(); return } layout() })
  ro.observe(dial)
  requestAnimationFrame(layout)
  renderHeader()

  // --- horizontal swipe: right = back to games, left = open active game ---
  let sx = 0, sy = 0, tracking = false, hSwipe = false
  dial.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; tracking = true; hSwipe = false }, true)
  dial.addEventListener('pointermove', e => {
    if (!tracking || hSwipe) return
    const dx = e.clientX - sx, dy = e.clientY - sy
    if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.3) hSwipe = true
  }, true)
  dial.addEventListener('pointerup', e => {
    if (!tracking) return
    tracking = false
    if (!hSwipe) return
    const dx = e.clientX - sx
    if (dx > 55 && view === 'menu') showGames()
    else if (dx < -55 && view === 'games') pickGame(active)
  }, true)
  dial.addEventListener('click', e => { if (hSwipe) { e.stopPropagation(); e.preventDefault(); hSwipe = false } }, true)
}
