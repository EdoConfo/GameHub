import { el, icon } from '../shared/ui.js'
import { createArcWheel } from '../shared/arcWheel.js'
import { games } from '../games/registry.js'

// The whole app is one horizontal canvas: a stack of full-width panels that
// slide left as you go deeper and right as you go back.
//   depth 0 = games wheel
//   depth 1 = the selected game's menu wheel
//   depth 2 = the chosen menu voice's interface (the game mounted at that phase)
// Nothing "pops up": the next panel is already on the canvas and slides in.
export function renderHub(root, ctx, startMenuId) {
  const canvas = el('div', { class: 'canvas' })
  const track = el('div', { class: 'canvas-track' })
  canvas.append(track)
  root.append(canvas)

  // panels: { node, cleanup, gameIndex? }
  const panels = []
  let current = 0
  let selectedGame = -1

  function setDepth(i) {
    current = i
    track.style.setProperty('--i', String(i))
  }

  function pushPanel(node, cleanup) {
    panels.push({ node, cleanup: cleanup || null })
    track.append(node)
    // next frame so the added column has layout before we slide
    requestAnimationFrame(() => setDepth(panels.length - 1))
  }

  function popTo(depth) {
    if (depth < 0 || depth >= panels.length) return
    if (depth < 1) selectedGame = -1 // menu panel is going away
    setDepth(depth)
    // remove deeper panels after the slide finishes
    setTimeout(() => {
      for (let k = panels.length - 1; k > depth; k--) {
        const p = panels[k]
        if (p.cleanup) try { p.cleanup() } catch {}
        p.node.remove()
        panels.pop()
      }
    }, 640) // a touch longer than --pan (.6s)
  }

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
  panels.push({ node: gamesPanel, cleanup: null })

  const gamesWheel = createArcWheel(gHost, {
    side: 'left',
    items: games.map(g => ({ title: g.name, sub: g.description })),
    onActivate: i => openMenu(i)
  })

  // ---- depth 1: a game's menu wheel ----
  function openMenu(i) {
    // (Re)build the menu panel if a different game is chosen or it's missing.
    if (selectedGame !== i || panels.length < 2) {
      // remove any existing menu/content panels
      for (let k = panels.length - 1; k >= 1; k--) {
        const p = panels[k]
        if (p.cleanup) try { p.cleanup() } catch {}
        p.node.remove(); panels.pop()
      }
      selectedGame = i
      const game = games[i]
      const menuPanel = el('div', { class: 'canvas-page' })
      const mp = el('div', { class: 'hub' })
      mp.append(el('div', { class: 'hub-header' }, [
        el('button', { class: 'icon-btn', 'aria-label': 'Indietro', onclick: () => popTo(0) }, icon('back')),
        el('span', { class: 'wordmark game-home-title' }, game.name.toUpperCase())
      ]))
      const mHost = el('div', { class: 'arc-host' })
      mp.append(mHost)
      mp.append(el('div', { class: 'hub-hint' }, 'scorri per scegliere · tocca per aprire'))
      menuPanel.append(mp)
      panels.push({ node: menuPanel, cleanup: null })
      track.append(menuPanel)

      const menu = game.menu || []
      createArcWheel(mHost, {
        side: 'right',
        items: menu.map(m => ({ title: m.title, sub: m.sub })),
        onActivate: e => openVoice(menu[e].phase)
      })
    }
    requestAnimationFrame(() => setDepth(1))
  }

  // ---- depth 2: a menu voice's interface (the game mounted at a phase) ----
  function openVoice(phase) {
    const game = games[selectedGame]
    // drop any existing content panel first
    for (let k = panels.length - 1; k >= 2; k--) {
      const p = panels[k]
      if (p.cleanup) try { p.cleanup() } catch {}
      p.node.remove(); panels.pop()
    }
    const content = el('div', { class: 'canvas-page canvas-scroll' })
    const gameRoot = el('div', { class: 'game-root' })
    content.append(gameRoot)
    const gctx = { ...ctx, exitToMenu: () => popTo(1) }
    const cleanup = game.mount(gameRoot, gctx, phase) || null
    pushPanel(content, cleanup)
  }

  // ---- horizontal swipe: right = back a level, left = go deeper ----
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
    if (dx > 55) { if (current > 0) popTo(current - 1) }
    else if (dx < -55) {
      if (current === 0) openMenu(gamesWheel.getActive())
      // deeper left-swipe (menu -> content) needs a specific voice; leave to taps
    }
  }, true)
  canvas.addEventListener('click', e => { if (hSwipe) { e.stopPropagation(); e.preventDefault(); hSwipe = false } }, true)

  // Deep entry: open straight on a game's menu (e.g. old /menu/:id links).
  if (startMenuId) {
    const idx = games.findIndex(g => g.id === startMenuId)
    if (idx >= 0) {
      track.classList.add('no-anim')
      openMenu(idx)
      requestAnimationFrame(() => { setDepth(1); requestAnimationFrame(() => track.classList.remove('no-anim')) })
    }
  }
}
