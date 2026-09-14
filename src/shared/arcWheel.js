import { el } from './ui.js'

// Reusable WOVE-style arc wheel. Big ghosted numbers ride a vertical circle on
// one side; the active item is centered (solid) with its title + subtitle.
// Swipe/scroll to rotate, tap the active item to activate it.
//   side: 'left'  -> circle bulges from the left, labels to the right of numbers
//   side: 'right' -> mirrored: bulges from the right, labels to the left
//   items: [{ title, sub }]
//   onActivate(index): called when the already-active item is tapped
// Returns { stage, setActive, setItems, enter, exit, layout, getActive, destroy }.
// Geometry of the circle a wheel rides. R is half the stage height, so the
// circle touches the top and bottom edges; its centre sits off-screen on the
// given side. The hub draws this circle once, above the strip, and slides it.
export function arcGeometry(W, H, side) {
  const sign = side === 'left' ? 1 : -1
  const R = H * 0.5
  const activeX = W * (side === 'left' ? 0.24 : 0.76)
  return { sign, R, activeX, Cx: activeX - sign * R, Cy: H * 0.5 }
}

export function createArcWheel(host, { side = 'left', items, onActivate, step = 0.2 }) {
  const N = items.length
  const sign = side === 'left' ? 1 : -1
  let active = 0
  let dragging = false
  let moved = false
  let swallowClick = false
  let startY = 0
  let baseActive = 0
  const geom = { W: 0, H: 0, Cx: 0, Cy: 0, R: 0, activeX: 0, step, stepPx: 120 }
  let enterTimer = 0

  const stage = el('div', { class: 'arc-stage' + (side === 'right' ? ' right' : '') })

  const nodes = items.map((it, i) =>
    el('button', { class: 'arc-item', 'aria-label': it.title, dataset: { i: String(i) } }, [
      // an icon / avatar sitting on the circle; plain index only as fallback
      it.lead ? el('span', { class: 'arc-lead' }, it.lead) : el('span', { class: 'arc-num' }, String(i + 1).padStart(2, '0')),
      el('div', { class: 'arc-info' }, [
        el('div', { class: 'arc-name' }, it.title),
        el('div', { class: 'arc-desc' }, it.sub || '')
      ])
    ])
  )
  nodes.forEach(n => stage.append(n))
  host.append(stage)

  function measure() {
    const r = stage.getBoundingClientRect()
    geom.W = r.width
    geom.H = r.height
    Object.assign(geom, arcGeometry(geom.W, geom.H, side))
    geom.stepPx = Math.max(52, geom.R * Math.sin(geom.step))
  }

  //   dx:   shift every item sideways (used to park them off-stage)
  //   fade: multiplies the usual opacity (0 = invisible)
  //   flat: drop the arc's bulge and line the items up vertically, all on the
  //         same x — how they leave and come back, so they travel as a column
  //         instead of sliding along the curve over the circle
  function placeItems(f, { dx = 0, fade = 1, flat = false } = {}) {
    for (let i = 0; i < N; i++) {
      const a = (i - f) * geom.step
      const x = flat ? geom.activeX : geom.Cx + sign * geom.R * Math.cos(a)
      const y = geom.Cy + geom.R * Math.sin(a)
      const dist = Math.abs(i - f)
      const it = nodes[i]
      it.style.left = (x + dx) + 'px'
      it.style.top = y + 'px'
      it.style.opacity = String(Math.max(0.10, 1 - dist * 0.42) * fade)
      it.style.transform = `translate(-50%, -50%) scale(${Math.max(0.62, 1 - dist * 0.14)})`
      it.classList.toggle('on', Math.round(f) === i)
    }
  }

  function layout() { measure(); placeItems(active) }

  // How far left the column has to go to clear the screen: from the items' own
  // x out past the left edge, with room for the badge's half width. They leave
  // the screen rather than sliding a little sideways, so they never sit on top
  // of whatever is taking the stage (the circle becoming the table).
  function offStage() { return -(geom.activeX + 64) }

  // Bring the items in from off-screen left. For when the view comes back and
  // the wheel is already built — folding the table back into the game's circle,
  // say: the circle grows and the beads ride in with it, instead of popping
  // into place. Give it the same ms as the thing it travels with. They arrive
  // as a vertical column and settle onto the arc.
  //   dx: where they start, relative to their spot (default: off-screen left)
  function enter({ dx = null, ms = 560 } = {}) {
    measure()
    stage.classList.add('dragging')            // park them with transitions off
    placeItems(active, { dx: dx == null ? offStage() : dx, fade: 0, flat: true })
    void stage.offsetWidth                     // commit that as the start state
    requestAnimationFrame(() => {
      stage.style.setProperty('--pan', ms + 'ms')
      stage.classList.remove('dragging')
      placeItems(active)
      clearTimeout(enterTimer)
      enterTimer = setTimeout(() => stage.style.removeProperty('--pan'), ms + 80)
    })
  }

  // The other half: straighten into a column, slide off the left edge and fade
  // out — for when the view is about to be covered (the game's circle shrinking
  // into the table). Once they're out they're put back on the arc invisibly, so
  // whatever shows the wheel next finds it whole.
  function exit({ dx = null, ms = 560 } = {}) {
    measure()
    stage.classList.remove('dragging')   // transitions ON...
    void stage.offsetWidth               // ...and seen as on before we move them
    stage.style.setProperty('--pan', ms + 'ms')
    placeItems(active, { dx: dx == null ? offStage() : dx, fade: 0, flat: true })
    clearTimeout(enterTimer)
    enterTimer = setTimeout(() => {
      stage.style.removeProperty('--pan')
      stage.classList.add('dragging')
      placeItems(active)
      requestAnimationFrame(() => requestAnimationFrame(() => stage.classList.remove('dragging')))
    }, ms + 80)
  }

  // Swap the labels (and lead icons) of the items already on the arc, leaving
  // geometry and the active index alone. Changing the interface language is a
  // text change, not a new wheel: rebuilding one makes every item fly in from
  // the corner it was born in. Needs the same number of items — hand a
  // different count to createArcWheel instead.
  function setItems(next) {
    if (!Array.isArray(next) || next.length !== N) return false
    next.forEach((it, i) => {
      const node = nodes[i]
      node.setAttribute('aria-label', it.title)
      const name = node.querySelector('.arc-name')
      const desc = node.querySelector('.arc-desc')
      const lead = node.querySelector('.arc-lead')
      if (name) name.textContent = it.title
      if (desc) desc.textContent = it.sub || ''
      if (lead && it.lead) lead.replaceChildren(it.lead)
    })
    return true
  }
  function setDragTransition(on) { stage.classList.toggle('dragging', !on) }
  function setActive(i) { active = Math.max(0, Math.min(N - 1, i)); setDragTransition(true); placeItems(active) }

  // ---- interaction ----
  stage.addEventListener('pointerdown', e => {
    e.preventDefault()
    dragging = true; moved = false; swallowClick = false
    startY = e.clientY; baseActive = active
    setDragTransition(false)
  })
  stage.addEventListener('pointermove', e => {
    if (!dragging) return
    const dy = e.clientY - startY
    if (Math.abs(dy) > 6) moved = true
    placeItems(Math.max(0, Math.min(N - 1, baseActive - dy / geom.stepPx)))
  })
  function endDrag(e) {
    if (!dragging) return
    dragging = false
    if (moved) { swallowClick = true; setActive(Math.round(baseActive - (e.clientY - startY) / geom.stepPx)) }
  }
  stage.addEventListener('pointerup', endDrag)
  stage.addEventListener('pointercancel', () => { if (dragging) { dragging = false; setActive(active) } })
  nodes.forEach((n, i) => n.addEventListener('click', () => {
    if (swallowClick) { swallowClick = false; return }
    if (i === active) onActivate(i)
    else setActive(i)
  }))
  stage.addEventListener('wheel', e => { e.preventDefault(); setActive(active + (e.deltaY > 0 ? 1 : -1)) }, { passive: false })

  const ro = new ResizeObserver(() => { if (!stage.isConnected) { ro.disconnect(); return } layout() })
  ro.observe(stage)
  // First placement must not animate: an item is born at 0,0 (top-left corner)
  // and only then put on the arc, so with transitions on it flies in from
  // there. `dragging` turns them off — and it has to stay off for a whole
  // frame AFTER the last placement, otherwise the browser sees the new
  // position and the re-enabled transition in the same style recalc and
  // animates anyway. Hence the second rAF.
  stage.classList.add('dragging')
  layout() // immediate (rAF may be throttled when the tab isn't visible)
  requestAnimationFrame(() => {
    layout()
    requestAnimationFrame(() => stage.classList.remove('dragging'))
  })

  return {
    stage, setActive, setItems, enter, exit, layout,
    getActive: () => active,
    destroy: () => { clearTimeout(enterTimer); ro.disconnect() }
  }
}
