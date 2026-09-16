import { el, icon, button, modal } from '../shared/ui.js'
import { t, langName, cycleLang } from '../shared/i18n.js'
import { getTheme, cycleTheme } from '../shared/theme.js'
import { createArcWheel } from '../shared/arcWheel.js'
import * as pwa from '../shared/pwa.js'
import { openProfileEditor, avatar } from './players.js'
import { openTableScene, TABLE_MORPH_MS } from './tableScene.js'
import { openPackEditor } from '../shared/packEditor.js'
import { openPlayerCard } from './playerCard.js'
import { TABLE_CLOSE_MS } from '../shared/tableStage.js'
import { games } from '../games/registry.js'

// The hub is a fixed scene with TWO still circles; the app is a window panning
// across it. Nothing rotates or drifts on its own: circles and the labels that
// ride them live in the same world and move together, 1:1 with the camera.
//
//   circle A: left arc = Giocatori / Impostazioni · right arc = GIOCHI
//   circle B: left arc = menu del gioco           · right arc = parole / regole /
//                                                   statistiche
//
// Both side arcs hold more than one thing: which one you see depends on the
// voice you came in from — Giocatori or Impostazioni on the left of A, Parole
// or Come si gioca on the right of B.
//
// "Gioca" doesn't leave the scene: circle B shrinks to the top of the screen
// and becomes the table, with a drawer rising from below (tableScene.js).
// The header is not part of the scene: it stays put and swaps content.
const V_SIDE = 0, V_GAMES = 1, V_MENU = 2, V_GAME = 3

// A line icon in a round badge that sits on the circle like a bead.
const badge = name => el('span', { class: 'arc-badge' }, icon(name))

// Which bead each side arc should come back to. Kept here, not in the address:
// the address names the page, and "the wheel happens to be turned to Anna" is
// not a page. Lives as long as the session, which is as long as it matters —
// you left that page a second ago.
const lastFocus = { players: null, settings: null }

export function renderHub(root, ctx, startMenuId, { table: startTable = false, side: startSide = null, gameSide: startGameSide = null, focusId = null } = {}) {
  let index = V_GAMES
  let selected = 0
  let sideKind = 'players'
  let table = null // the game's table ("Gioca"), while it's open
  let sideWheel = null
  let menuWheel = null
  let gameWheel = null
  let gameKind = 'words' // what the right arc of the game's circle is showing
  let world = { W: 0, H: 0, R: 0, xA: 0, xB: 0, top: 0, cam: [0, 0, 0], width: 0 }

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
  const hosts = [0, 1, 2, 3].map(() => {
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
    // The header floats over the scene, so the scene starts under it: the band
    // it leaves is what the circles are measured against. Told in CSS, so the
    // wheels — which measure their own host — follow without being asked.
    const top = header.getBoundingClientRect().height
    canvas.style.setProperty('--hub-top', top + 'px')
    const W = r.width, H = r.height - top
    const R = H * 0.5                 // circles touch the band's top and bottom
    const xA = R + 0.76 * W           // puts the leftmost view at world 0
    const xB = xA + 2 * R + 0.9 * W   // close enough that an arc is always in sight
    // one camera spot per view: the two arcs of circle A, then the two of B
    world = {
      W, H, R, xA, xB, top,
      cam: [0, 2 * R + 0.52 * W, 2 * R + 0.9 * W, 4 * R + 1.42 * W],
      width: xB + R + W
    }
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

  // Where you are in the scene, written in the address bar. Panning isn't a
  // navigation — no history entry, no re-render — but a reload has to come
  // back to the view you were looking at, not to the last one that happened to
  // write a hash.
  function hashHere() {
    if (index === V_GAME) return '#/' + games[selected].id + '/' + gameKind
    if (index === V_MENU) return '#/' + games[selected].id + (table ? '/table' : '')
    if (index === V_SIDE) return sideKind === 'settings' ? '#/settings' : '#/players'
    return '#/'
  }

  function syncHash() {
    const here = hashHere()
    if (location.hash !== here) history.replaceState(null, '', here)
  }

  function moveCamera(i, animate = true) {
    const from = world.cam[index]
    index = Math.max(0, Math.min(3, i))
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
    syncHash()
    if (!animate) requestAnimationFrame(() => {
      scene.style.transitionDuration = ''
      hosts.forEach(h => { h.style.transitionDuration = '' })
    })
  }

  function goto(i) {
    if (i === V_MENU) { selected = gamesWheel.getActive(); buildMenu() }
    if (i === V_SIDE) buildSide(sideKind)
    if (i === V_GAME) buildGameSide(gameKind)
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
    } else if (index === V_GAME) {
      // page on the right of its circle: the way back is to the left
      header.replaceChildren(
        el('button', { class: 'icon-btn', 'aria-label': t('common.back'), onclick: () => goto(V_MENU) }, icon('back')),
        el('span', { class: 'wordmark game-home-title' },
          (gameKind === 'rules' ? t('mw.rules.title')
            : gameKind === 'stats' ? t('stats.title')
              : t('packs.title')).toUpperCase())
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
      const installed = pwa.isInstalled()
      return [
        { id: 'theme', title: t('settings.theme'), sub: t('settings.theme.' + theme), lead: badge(themeGlyph[theme]) },
        { id: 'language', title: t('settings.language'), sub: langName(), lead: badge('globe') },
        // Named after the action while there is one to take, like the two above.
        // Once the app is running from the Home screen there is nothing left to
        // do and it becomes a plain statement of fact.
        installed
          ? { id: 'offline', title: t('settings.offline'), sub: t('settings.offlineSub'), lead: badge('offline') }
          : { id: 'offline', title: t('settings.install'), sub: t('settings.installSub'), lead: badge('offline') }
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
    if (focus == null) focus = lastFocus[kind]
    hosts[V_SIDE].replaceChildren()
    const items = sideItems(kind)
    sideWheel = createArcWheel(hosts[V_SIDE], {
      side: 'right',
      items,
      onActivate: i => {
        const it = items[i]
        if (!it) return
        if (kind === 'settings') {
          lastFocus.settings = it.id
          if (it.id === 'theme') {
            cycleTheme()
            repaint()
          } else if (it.id === 'language') {
            cycleLang()
            repaint()
          } else if (it.id === 'offline') {
            openInstall()
          }
          return
        }
        if (it.id === 'new') openProfileEditor(ctx, null, saved => {
          if (saved) lastFocus.players = saved.id
          buildSide('players', saved && saved.id)
          renderHeader()
        })
        else {
          // a panel over the arc, not a page: closing it leaves you here
          lastFocus.players = it.id
          openPlayerCard(ctx, it.id, { onChanged: () => { buildSide('players', it.id); renderHeader() } })
        }
      }
    })
    const at = items.findIndex(it => it.id === focus)
    if (at >= 0) sideWheel.setActive(at)
    renderHeader()
    if (index === V_SIDE) syncHash() // Giocatori <-> Impostazioni, camera still
  }

  // Same beads, new words: swap the labels in place on all three wheels. No
  // rebuild, so nothing slides in from the corner and the arcs don't move.
  function repaint() {
    gamesWheel.setItems(games.map(g => ({ title: g.name, sub: g.description, lead: badge(g.glyph || 'play') })))
    if (menuWheel) menuWheel.setItems(menuItems())
    if (gameWheel) gameWheel.setItems(gameSideItems(gameKind))
    if (sideWheel) sideWheel.setItems(sideItems(sideKind))
    renderHeader()
  }

  // ---- circle A, right arc: GIOCHI ----
  const gamesWheel = createArcWheel(hosts[V_GAMES], {
    side: 'left',
    items: games.map(g => ({ title: g.name, sub: g.description, lead: badge(g.glyph || 'play') })),
    onActivate: () => goto(V_MENU)
  })

  // ---- circle B, right arc: this game's words, or how it's played ----
  // One arc, two contents, like Giocatori and Impostazioni share the other one.
  // Every pack the app has for this game: the ones it came with, the ones you
  // changed, the ones you wrote. Tapping one opens it; the last bead writes a
  // new one.
  function wordsItems() {
    const store = games[selected].packs
    if (!store) return []
    const items = store.allPacks().map(p => ({
      id: p.id,
      title: p.name,
      sub: `${p.items.length} ${store.unit}` +
        (p.custom ? t('packs.tagCustom') : p.modified ? t('packs.tagModified') : ''),
      lead: badge(p.icon || 'words')
    }))
    items.push({ id: 'new', title: t('packs.newTitle'), sub: t('packs.newSub'), lead: badge('plus') })
    return items
  }

  // The rules, a bead per section. The bead says what the section is about;
  // the section itself opens in a panel, which is where reading is comfortable.
  function rulesItems() {
    const list = games[selected].rules || []
    return list.map((sec, i) => ({
      id: 'rule-' + i,
      title: sec.title,
      sub: sec.items.map(r => r.title).join(' · '),
      lead: badge('help')
    }))
  }

  // Who wins at this game, best first — so scrolling the arc IS the ranking.
  // A face is easier to place than a row of a table, and tapping one opens that
  // player's page, where the same numbers live across every game.
  function statsItems() {
    const game = games[selected]
    const rows = Object.entries(ctx.stats.get(game.id) || {})
      .map(([id, rec]) => ({ p: ctx.players.get(id), ...rec }))
      .filter(r => r.p)
      .sort((a, b) => b.won - a.won || b.played - a.played)
    if (!rows.length) {
      return [{ id: 'none', title: t('stats.emptyTitle'), sub: t('stats.emptySub'), lead: badge('stats') }]
    }
    return rows.map(r => ({
      id: r.p.id,
      title: r.p.name,
      sub: t('stats.sub', {
        played: r.played,
        won: r.won,
        pct: r.played ? Math.round((r.won / r.played) * 100) : 0
      }),
      lead: avatar(r.p, 56)
    }))
  }

  function gameSideItems(kind) {
    if (kind === 'rules') return rulesItems()
    if (kind === 'stats') return statsItems()
    return wordsItems()
  }

  // Installing: the browser does it if it can, and if it can't we can only say
  // where the button is. The steps are per platform because that is the one
  // thing that genuinely differs — iOS hides it behind Share, Android behind the
  // menu — and they're only ever reached when the browser has already told us
  // it won't handle it itself.
  function openInstall() {
    if (pwa.isInstalled()) return            // nothing left to do, and it says so
    if (pwa.canInstall()) { pwa.install(); return }
    const steps = { ios: 3, android: 2, macos: 2, desktop: 2, none: 2 }
    const how = pwa.howTo()
    const lines = Array.from({ length: steps[how] }, (_, i) => t(`install.${how}.${i + 1}`))
    // On a browser that can't install there is nothing to follow in order, so
    // the same two lines are prose: numbering them would promise a procedure
    // that doesn't exist.
    const body = how === 'none'
      ? lines.map(line => el('p', { class: 'muted' }, line))
      : [el('p', { class: 'muted' }, t('install.why')),
         el('ol', { class: 'steps' }, lines.map(line => el('li', {}, line)))]
    const m = modal({
      title: t(how === 'none' ? 'install.noneTitle' : 'install.title'),
      content: body,
      actions: [button(t('common.done'), { variant: 'ghost', onClick: () => m.close() })]
    })
  }

  function openRules(section) {
    const m = modal({
      title: section.title,
      content: section.items.map(r => el('div', { class: 'rule' }, [
        el('div', { class: 'rule-title' }, r.title),
        el('div', { class: 'rule-desc muted' }, r.text)
      ])),
      actions: [button(t('common.done'), { variant: 'ghost', onClick: () => m.close() })]
    })
  }

  function buildGameSide(kind) {
    gameKind = kind
    const game = games[selected]
    hosts[V_GAME].replaceChildren()
    const items = gameSideItems(kind)
    gameWheel = createArcWheel(hosts[V_GAME], {
      side: 'left',
      items,
      detail: kind === 'stats' ? 'always' : 'active',
      onActivate: i => {
        const it = items[i]
        if (!it) return
        if (kind === 'rules') { openRules(game.rules[i]); return }
        if (kind === 'stats') {
          // through the route, not openTable(): that one grows the table out of
          // circle B as it stands on screen, and from here the camera is two
          // views away from it
          if (it.id === 'none') { if (game.table) ctx.router.go('/' + game.id + '/table'); return }
          // the card comes up over the ranking, and closing it leaves you on
          // the ranking — not on the players arc, which is where a page went
          openPlayerCard(ctx, it.id, { onChanged: () => buildGameSide('stats') })
          return
        }
        const store = game.packs
        if (!store) return
        const again = () => { buildGameSide('words'); renderHeader() }
        openPackEditor(store, it.id === 'new' ? null : store.getPack(it.id), { onDone: again })
      }
    })
    renderHeader()
  }

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
        const phase = menu[j].phase
        if (phase === 'setup' && game.table) openTable()
        // these two live on the arc next door: pan there, don't rebuild the hub
        else if (phase === 'words' || phase === 'rules' || phase === 'stats') { buildGameSide(phase); moveCamera(V_GAME) }
        else ctx.router.go('/' + game.id + '/' + phase)
      }
    })
  }

  // ---- "Gioca": circle B becomes the table ----
  function circleBOnScreen() {
    const { H, R, xB, cam, top } = world
    // in canvas coordinates, so the table can morph out of it: the scene's own
    // centre plus however far down the scene starts
    return { cx: xB - cam[V_MENU], cy: top + H / 2, r: R }
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
    syncHash()
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
    syncHash()
    renderHeader()
    if (menuWheel) menuWheel.enter({ ms: TABLE_CLOSE_MS })
    t.close(circleBOnScreen(), () => { circleB.style.visibility = '' })
  }

  buildSide('players')
  buildMenu()

  // ---- horizontal swipe pans the window ----
  // With the table up the same swipe means one thing only: to the right and
  // you're back at the game's menu, the circle reforming the way it came. It
  // has to start on the background, though — the seats, the table top and the
  // drawer all own their own gestures, and a swipe there belongs to them.
  const TABLE_OWN = '.drawer, .seat, .table-pad'
  let sx = 0, sy = 0, tracking = false, hSwipe = false
  canvas.addEventListener('pointerdown', e => {
    if (table && e.target && e.target.closest && e.target.closest(TABLE_OWN)) { tracking = false; return }
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
    if (table) { if (dx > 55) closeTable(); return }
    if (dx > 55) goto(index - 1)
    else if (dx < -55) goto(index + 1)
  }, true)
  canvas.addEventListener('click', e => { if (hSwipe) { e.stopPropagation(); e.preventDefault(); hSwipe = false } }, true)

  const ro = new ResizeObserver(() => { if (!canvas.isConnected) { ro.disconnect(); return } layout(false) })
  ro.observe(canvas)

  // The bead changes its mind twice: when the browser offers to install, and
  // when the app is next opened from the Home screen. Both arrive as events, so
  // it just relabels itself instead of being stale until the next visit.
  const offPwa = pwa.onChange(() => {
    if (!canvas.isConnected) { offPwa(); return }
    if (sideWheel && sideKind === 'settings') repaint()
  })

  if (startMenuId) {
    const i = games.findIndex(g => g.id === startMenuId)
    if (i >= 0) { gamesWheel.setActive(i); selected = i; buildMenu(); index = V_MENU }
  } else if (startSide) {
    buildSide(startSide, focusId)
    index = V_SIDE
  }
  if (startGameSide && index === V_MENU) { buildGameSide(startGameSide); index = V_GAME }
  layout(false)
  requestAnimationFrame(() => layout(false))
  if (startTable && index === V_MENU) openTable(false)
}
