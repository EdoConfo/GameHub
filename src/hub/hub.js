import { el, icon } from '../shared/ui.js'
import { games } from '../games/registry.js'

// One real, whole circle: its diameter equals the screen height, so it touches
// the top and bottom edges (the sides run off-screen on a phone). Games live on
// the LEFT of the circle, the selected game's menu on the RIGHT.
export function renderHub(root, ctx) {
  let active = 0

  const dial = el('div', { class: 'dial' })

  // The circle (parametric: R = H/2, centred).
  const SVGNS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(SVGNS, 'svg')
  svg.setAttribute('class', 'dial-circle')
  const circle = document.createElementNS(SVGNS, 'circle')
  circle.setAttribute('class', 'arc-line')
  svg.append(circle)
  dial.append(svg)

  // Header.
  dial.append(el('div', { class: 'hub-header dial-header' }, [
    el('span', { class: 'wordmark' }, 'GAMEHUB'),
    el('div', { class: 'hub-header-actions' }, [
      el('button', { class: 'icon-btn', 'aria-label': 'Giocatori', onclick: () => ctx.router.go('/players') }, icon('players')),
      el('button', { class: 'icon-btn', 'aria-label': 'Impostazioni', onclick: () => ctx.router.go('/settings') }, icon('settings'))
    ])
  ]))

  const leftCol = el('div', { class: 'dial-side dial-left' })
  const rightCol = el('div', { class: 'dial-side dial-right' })
  dial.append(leftCol, rightCol)
  root.append(dial)

  function renderGames() {
    leftCol.replaceChildren()
    games.forEach((g, i) => {
      leftCol.append(el('button', {
        class: 'dial-item' + (i === active ? ' on' : ''),
        onclick: () => { active = i; renderGames(); renderMenu() }
      }, [
        el('span', { class: 'dial-num' }, String(i + 1).padStart(2, '0')),
        el('span', { class: 'dial-label' }, g.name)
      ]))
    })
  }

  function renderMenu() {
    rightCol.replaceChildren()
    const menu = games[active].menu || []
    menu.forEach(v => {
      rightCol.append(el('button', {
        class: 'dial-item voice',
        onclick: () => ctx.router.go('/game/' + games[active].id + '/' + v.phase)
      }, [
        el('span', { class: 'dial-label' }, v.title)
      ]))
    })
  }

  function layoutCircle() {
    const r = dial.getBoundingClientRect()
    circle.setAttribute('cx', String(r.width / 2))
    circle.setAttribute('cy', String(r.height / 2))
    circle.setAttribute('r', String(r.height / 2))
  }
  const ro = new ResizeObserver(() => { if (!dial.isConnected) { ro.disconnect(); return } layoutCircle() })
  ro.observe(dial)
  requestAnimationFrame(layoutCircle)

  renderGames()
  renderMenu()
}
