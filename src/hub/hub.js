import { el, icon, transitionTo } from '../shared/ui.js'
import { games } from '../games/registry.js'

// Hub = WOVE-style arc selector. Big ghosted numbers ride a vertical arc on the
// left; the active game sits centered (dark) with its name + description to the
// right. Swipe up/down to rotate the selection, tap the centered item to enter.
export function renderHub(root, ctx) {
  const N = games.length
  let active = 0
  let dragging = false
  let moved = false
  let startY = 0
  let baseActive = 0
  let geom = { W: 0, H: 0, Cx: 0, Cy: 0, R: 0, activeX: 0, step: 0.384, stepPx: 120 }

  const hub = el('div', { class: 'hub' })

  // Header: wordmark + settings
  hub.append(el('div', { class: 'hub-header' }, [
    el('span', { class: 'wordmark' }, 'GAMEHUB'),
    el('div', { class: 'hub-header-actions' }, [
      el('button', { class: 'icon-btn', 'aria-label': 'Giocatori', onclick: () => ctx.router.go('/players') }, icon('players')),
      el('button', { class: 'icon-btn', 'aria-label': 'Impostazioni', onclick: () => ctx.router.go('/settings') }, icon('settings'))
    ])
  ]))

  const stage = el('div', { class: 'arc-stage' })
  const SVGNS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(SVGNS, 'svg')
  svg.setAttribute('class', 'arc-svg')
  // Full circle: centre sits off-screen left, only the right bulge is visible,
  // entering/exiting the top and bottom edges (WOVE-style). overflow:hidden clips the rest.
  const arcCircle = document.createElementNS(SVGNS, 'circle')
  arcCircle.setAttribute('class', 'arc-line')
  svg.append(arcCircle)
  stage.append(svg)

  // Number items. Each keeps its own name (fades with the item) + description
  // (shown only when active). The name stays visible even when not highlighted.
  const items = games.map((game, i) =>
    el('button', {
      class: 'arc-item',
      'data-i': String(i),
      'aria-label': game.name,
      dataset: { i: String(i) }
    }, [
      el('span', { class: 'arc-num' }, String(i + 1).padStart(2, '0')),
      el('div', { class: 'arc-info' }, [
        el('div', { class: 'arc-name' }, game.name),
        el('div', { class: 'arc-desc' }, game.description || '')
      ])
    ])
  )
  items.forEach(it => stage.append(it))

  hub.append(stage)
  hub.append(el('div', { class: 'hub-hint' }, 'scorri per scegliere · tocca per giocare'))

  // Offline note (kept, subtle, at the very bottom)
  hub.append(el('div', { class: 'offline-note' }, [
    el('strong', {}, '📴 Funziona offline. '),
    'Aggiungila alla schermata Home per usarla come app.'
  ]))

  root.append(hub)

  // ---- geometry ----
  function measure() {
    const r = stage.getBoundingClientRect()
    geom.W = r.width
    geom.H = r.height
    geom.R = geom.H * 0.62
    geom.activeX = geom.W * 0.24
    geom.Cx = geom.activeX - geom.R
    geom.Cy = geom.H * 0.5
    geom.stepPx = Math.max(70, geom.H * 0.2)
  }

  function placeItems(f) {
    for (let i = 0; i < N; i++) {
      const a = (i - f) * geom.step
      const x = geom.Cx + geom.R * Math.cos(a)
      const y = geom.Cy + geom.R * Math.sin(a)
      const dist = Math.abs(i - f)
      const it = items[i]
      it.style.left = x + 'px'
      it.style.top = y + 'px'
      it.style.opacity = String(Math.max(0.10, 1 - dist * 0.42))
      it.style.transform = `translate(-50%, -50%) scale(${Math.max(0.62, 1 - dist * 0.14)})`
      it.classList.toggle('on', Math.round(f) === i)
    }
    // full circle (only its right bulge is visible)
    arcCircle.setAttribute('cx', String(geom.Cx))
    arcCircle.setAttribute('cy', String(geom.Cy))
    arcCircle.setAttribute('r', String(geom.R))
  }

  function layout() {
    measure()
    placeItems(active)
  }

  function setDragTransition(on) {
    stage.classList.toggle('dragging', !on)
  }

  function setActive(i) {
    active = Math.max(0, Math.min(N - 1, i))
    setDragTransition(true)
    placeItems(active)
  }

  function open(i) {
    const r = items[i].getBoundingClientRect()
    const x = r.left + r.width / 2
    const y = r.top + r.height / 2
    transitionTo(x, y, () => ctx.router.go('/game/' + games[i].id))
  }

  // ---- interaction ----
  // Pointer/touch = rotate the wheel by dragging. Selection/opening is handled
  // by a native click on each item (reliable across mouse, touch, and no
  // pointer-capture quirks). A drag suppresses the click that follows it.
  let swallowClick = false
  stage.addEventListener('pointerdown', e => {
    e.preventDefault() // stop the browser from starting a text selection on drag
    dragging = true
    moved = false
    swallowClick = false
    startY = e.clientY
    baseActive = active
    setDragTransition(false)
  })
  stage.addEventListener('pointermove', e => {
    if (!dragging) return
    const dy = e.clientY - startY
    if (Math.abs(dy) > 6) moved = true
    const f = Math.max(0, Math.min(N - 1, baseActive - dy / geom.stepPx))
    placeItems(f)
  })
  function endDrag(e) {
    if (!dragging) return
    dragging = false
    if (moved) {
      swallowClick = true // the click after a drag shouldn't select/open
      setActive(Math.round(baseActive - (e.clientY - startY) / geom.stepPx))
    }
  }
  stage.addEventListener('pointerup', endDrag)
  stage.addEventListener('pointercancel', () => { if (dragging) { dragging = false; setActive(active) } })

  // Native click per item: select if not active, open if already active.
  items.forEach((it, i) => it.addEventListener('click', () => {
    if (swallowClick) { swallowClick = false; return }
    if (i === active) open(active)
    else setActive(i)
  }))

  // Desktop convenience
  stage.addEventListener('wheel', e => {
    e.preventDefault()
    setActive(active + (e.deltaY > 0 ? 1 : -1))
  }, { passive: false })

  // Recompute on resize; stop observing once the hub leaves the DOM.
  const ro = new ResizeObserver(() => {
    if (!stage.isConnected) { ro.disconnect(); return }
    layout()
  })
  ro.observe(stage)

  // First layout after the element has real dimensions.
  requestAnimationFrame(layout)
}
