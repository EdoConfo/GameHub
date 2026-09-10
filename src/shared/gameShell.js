import { el, icon } from './ui.js'
import { createArcWheel } from './arcWheel.js'

// A game "shell": one big fixed circle + a persistent header (back + game name)
// + two lanes that slide OVER the circle:
//   lane 0 = the menu wheel (voices sit on the circle's edge)
//   lane 1 = the chosen voice's interface (the game mounted at that phase)
// The circle never moves, so it always reads as a half-circle at the right
// edge; its centre is off-screen (visible only on very wide screens).
export function createGameShell(game, ctx, { onExit }) {
  const node = el('div', { class: 'canvas-page game-shell' })

  // Fixed circle behind everything (mirror of the right-side arc wheel).
  const SVGNS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(SVGNS, 'svg')
  svg.setAttribute('class', 'shell-circle')
  const circle = document.createElementNS(SVGNS, 'circle')
  circle.setAttribute('class', 'arc-line')
  svg.append(circle)
  node.append(svg)

  // Sliding lanes.
  const lanes = el('div', { class: 'shell-lanes' })
  const menuLane = el('div', { class: 'shell-lane' })
  const contentLane = el('div', { class: 'shell-lane canvas-scroll' })
  lanes.append(menuLane, contentLane)
  node.append(lanes)

  // Persistent header (back + game name) — invariant across menu and content.
  const backBtn = el('button', { class: 'icon-btn', 'aria-label': 'Indietro', onclick: () => shellBack() }, icon('back'))
  node.append(el('div', { class: 'hub-header shell-header' }, [backBtn, el('span', { class: 'wordmark game-home-title' }, game.name.toUpperCase())]))

  // Menu wheel.
  const menuHost = el('div', { class: 'arc-host' })
  menuLane.append(menuHost)
  menuLane.append(el('div', { class: 'hub-hint shell-hint' }, 'scorri per scegliere · tocca per aprire'))
  const menu = game.menu || []
  const wheel = createArcWheel(menuHost, {
    side: 'right',
    items: menu.map(m => ({ title: m.title, sub: m.sub })),
    onActivate: e => openVoice(menu[e].phase)
  })

  let atContent = false
  let cleanup = null

  function setLane(i) { lanes.style.setProperty('--li', String(i)) }

  function openVoice(phase) {
    if (cleanup) { try { cleanup() } catch {} cleanup = null }
    contentLane.replaceChildren()
    const gameRoot = el('div', { class: 'game-root' })
    contentLane.append(gameRoot)
    cleanup = game.mount(gameRoot, { ...ctx, exitToMenu: showMenu }, phase) || null
    atContent = true
    setLane(1)
  }

  function showMenu() {
    atContent = false
    setLane(0)
    // tear down the content after the slide back
    setTimeout(() => {
      if (!atContent) {
        if (cleanup) { try { cleanup() } catch {} cleanup = null }
        contentLane.replaceChildren()
      }
    }, 660)
  }

  // Back: at content, delegate to the current screen's own (hidden) back so
  // in-game step-backs keep working; at menu, leave the game.
  function shellBack() {
    if (atContent) {
      const b = contentLane.querySelector('.game-root .topbar .icon-btn')
      if (b) b.click()
      else showMenu()
    } else onExit()
  }

  function layoutCircle() {
    const r = node.getBoundingClientRect()
    const W = r.width, H = r.height
    const R = H * 0.62
    const activeX = W * 0.76
    circle.setAttribute('cx', String(activeX + R))
    circle.setAttribute('cy', String(H * 0.5))
    circle.setAttribute('r', String(R))
  }
  const ro = new ResizeObserver(() => { if (!node.isConnected) { ro.disconnect(); return } layoutCircle() })
  ro.observe(node)
  requestAnimationFrame(layoutCircle)

  return {
    node,
    atMenu: () => !atContent,
    back: shellBack,
    openActive: () => { if (!atContent) openVoice(menu[wheel.getActive()].phase) },
    destroy: () => { ro.disconnect(); if (cleanup) { try { cleanup() } catch {} } }
  }
}
