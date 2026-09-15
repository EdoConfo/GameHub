import { el, icon } from '../shared/ui.js'
import { t, langName, cycleLang } from '../shared/i18n.js'
import { getTheme, cycleTheme } from '../shared/theme.js'
import { createArcWheel } from '../shared/arcWheel.js'
import { openProfileEditor, avatar } from './players.js'
import { openTableScene, TABLE_MORPH_MS } from './tableScene.js'
import { TABLE_CLOSE_MS } from '../shared/tableStage.js'
import { games } from '../games/registry.js'

// The hub is a fixed scene with TWO still circles; the app is a window panning
// across it. Nothing rotates or drifts on its own: circles and the labels that
// ride them live in the same world and move together, 1:1 with the camera.
//
//   circle A: left arc = Giocatori / Impostazioni · right arc = GIOCHI
//   circle B: left arc = menu del gioco           · right arc = (libero)
//
// "Gioca" doesn't leave the scene: circle B shrinks to the top of the screen
// and becomes the table, with a drawer rising from below (tableScene.js).
// The header is not part of the scene: it stays put and swaps content.
const V_SIDE = 0, V_GAMES = 1, V_MENU = 2

// A line icon in a round badge that sits on the circle like a bead.
const badge = name => el('span', { class: 'arc-badge' }, icon(name))

export function renderHub(root, ctx, startMenuId, { table: startTable = false, side: startSide = null, focusId = null } = {}) {
  let index = V_GAMES
  let selected = 0
  let sideKind = 'players'
  let table = null // the game's table ("Gioca"), while it's open
  let sideWheel = null
  let menuWheel = null
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
  canvas.append(header)
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
    if (table) table.refit()
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
          el('button', { class: 'icon-btn', 'aria-label': t('hub.players'), onclick: () => { buildSide('players'); moveCamera(V_SIDE) } }, icon('players')),
          el('button', { class: 'icon-btn', 'aria-label': t('hub.settings'), onclick: () => { buildSide('settings'); moveCamera(V_SIDE) } }, icon('settings'))
        ])
      )
    } else if (index === V_MENU) {
      // page on the right of its circle: back arrow left, name right
      header.replaceChildren(
        el('button', { class: 'icon-btn', 'aria-label': t('common.back'), onclick: () => (table ? closeTable() : goto(V_GAMES)) }, icon('back')),
        el('span', { class: 'wordmark game-home-title' }, games[selected].name.toUpperCase())
      )
    } else {
      // page on the left of its circle: mirrored — name left, arrow right
      header.replaceChildren(
        el('span', { class: 'wordmark game-home-title' },
          (sideKind === 'settings' ? t('hub.settings') : t('hub.players')).toUpperCase()),
        el('button', { class: 'icon-btn', 'aria-label': t('common.back'), onclick: () => goto(V_GAMES) }, icon('forward'))
      )
    }
  }

  // ---- circle A, left arc: Giocatori / Impostazioni ----
  // The beads of the arc, as data. Read fresh every time: the theme bead shows
  // the theme it will switch AWAY from, the language bead the current language.
  function sideItems(kind) {
    if (kind === 'settings') {
      // the bead names the CHOICE, not the colour: on 'Sistema' it says so,
      // whichever of the two the phone is showing at that moment
      const theme = getTheme()
      const themeGlyph = { system: 'system', light: 'sun', dark: 'moon' }
      return [
        { id: 'theme', title: t('settings.theme'), sub: t('settings.theme.' + theme), lead: badge(themeGlyph[theme]) },
        { id: 'language', title: t('settings.language'), sub: langName(), lead: badge('globe') },
        { id: 'offline', title: t('settings.offline'), sub: t('settings.offlineSub'), lead: badge('offline') }
      ]
    }
    const items = ctx.players.all().map(p => ({ id: p.id, title: p.name, sub: t('players.profile'), lead: avatar(p, 56) }))
    items.push({ id: 'new', title: t('common.new'), sub: t('players.addPlayer'), lead: badge('plus') })
    return items
  }

  // focus: which bead to keep centred on the wheel — a player id on the
  // Giocatori arc, a setting name on the Impostazioni one — so that coming
  // back from a page lands where you left.
  //
  // This builds a NEW wheel, so call it only when the beads themselves change
  // (a player added). Theme and language only change words and icons: those go
  // through repaint(), which leaves the wheel where it stands.
  function buildSide(kind, focus = null) {
    sideKind = kind
    hosts[V_SIDE].replaceChildren()
    const items = sideItems(kind)
    sideWheel = createArcWheel(hosts[V_SIDE], {
      side: 'right',
      items,
      onActivate: i => {
        const it = items[i]
        if (!it) return
        if (kind === 'settings') {
          if (it.id === 'theme') {
            cycleTheme()
            repaint()
          } else if (it.id === 'language') {
            cycleLang()
            repaint()
          }
          return
        }
        if (it.id === 'new') openProfileEditor(ctx, null, saved => { buildSide('players', saved && saved.id); renderHeader() })
        else ctx.router.go('/player/' + it.id)
      }
    })
    const at = items.findIndex(it => it.id === focus)
    if (at >= 0) sideWheel.setActive(at)
    renderHeader()
  }

  // Same beads, new words: swap the labels in place on all three wheels. No
  // rebuild, so nothing slides in from the corner and the arcs don't move.
  function repaint() {
    gamesWheel.setItems(games.map(g => ({ title: g.name, sub: g.description, lead: badge(g.glyph || 'play') })))
    if (menuWheel) menuWheel.setItems(menuItems())
    if (sideWheel) sideWheel.setItems(sideItems(sideKind))
    renderHeader()
  }

  // ---- circle A, right arc: GIOCHI ----
  const gamesWheel = createArcWheel(hosts[V_GAMES], {
    side: 'left',
    items: games.map(g => ({ title: g.name, sub: g.description, lead: badge(g.glyph || 'play') })),
    onActivate: () => goto(V_MENU)
  })

  // ---- circle B, left arc: menu del gioco ----
  const menuItems = () => (games[selected].menu || []).map(m => ({ title: m.title, sub: m.sub, lead: badge(m.glyph || 'play') }))

  function buildMenu() {
    const game = games[selected]
    hosts[V_MENU].replaceChildren()
    const menu = game.menu || []
    menuWheel = createArcWheel(hosts[V_MENU], {
      side: 'right',
      items: menuItems(),
      onActivate: j => {
        if (menu[j].phase === 'setup' && game.table) openTable()
        else ctx.router.go('/game/' + game.id + '/' + menu[j].phase)
      }
    })
  }

  // ---- "Gioca": circle B becomes the table ----
  function circleBOnScreen() {
    const { H, R, xB, cam } = world
    return { cx: xB - cam[V_MENU], cy: H / 2, r: R }
  }

  // "Gioca": the circle shrinks into the table and the menu beads leave with
  // it, sliding out the way they came in. Arriving straight on the table
  // (a reload on #/table/...) there is nothing to morph out of, so the beads
  // just aren't there — no exit to play.
  function openTable(morph = true) {
    const game = games[selected]
    if (table || !game.table) return
    if (morph && menuWheel) {
      // the host's own fade would blank the beads in .22s, before they've gone
      // anywhere: stretch it over the circle's travel instead
      canvas.style.setProperty('--tabling-out', TABLE_MORPH_MS + 'ms')
      menuWheel.exit({ ms: TABLE_MORPH_MS })
    } else {
      canvas.style.removeProperty('--tabling-out')
    }
    canvas.classList.add('tabling')
    circleB.style.visibility = 'hidden' // the table's own circle takes over, same place
    table = openTableScene(canvas, header, ctx, game, { from: morph ? circleBOnScreen() : null })
    history.replaceState(null, '', '#/table/' + game.id)
    renderHeader()
  }

  // Leaving the table: it shrinks back into the game's circle. The menu beads
  // ride in with it from the left instead of popping up where they stand —
  // same duration as the table's own glide, so circle and beads arrive
  // together. Every game with a table gets this, it isn't Mister White's.
  function closeTable() {
    if (!table) return
    const t = table
    table = null
    canvas.classList.remove('tabling')
    history.replaceState(null, '', '#/menu/' + games[selected].id)
    renderHeader()
    if (menuWheel) menuWheel.enter({ ms: TABLE_CLOSE_MS })
    t.close(circleBOnScreen(), () => { circleB.style.visibility = '' })
  }

  buildSide('players')
  buildMenu()

  // ---- horizontal swipe pans the window ----
  let sx = 0, sy = 0, tracking = false, hSwipe = false
  canvas.addEventListener('pointerdown', e => {
    if (table) { tracking = false; return } // the table has its own gestures
    sx = e.clientX; sy = e.clientY; tracking = true; hSwipe = false
  }, true)
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
  } else if (startSide) {
    buildSide(startSide, focusId)
    index = V_SIDE
  }
  layout(false)
  requestAnimationFrame(() => layout(false))
  if (startTable && index === V_MENU) openTable(false)
}
