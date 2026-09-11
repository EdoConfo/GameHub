import { el } from './ui.js'

// Reusable WOVE-style arc wheel. Big ghosted numbers ride a vertical circle on
// one side; the active item is centered (solid) with its title + subtitle.
// Swipe/scroll to rotate, tap the active item to activate it.
//   side: 'left'  -> circle bulges from the left, labels to the right of numbers
//   side: 'right' -> mirrored: bulges from the right, labels to the left
//   items: [{ title, sub }]
//   onActivate(index): called when the already-active item is tapped
// Returns { stage, setActive, layout, destroy }.
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

  function placeItems(f) {
    for (let i = 0; i < N; i++) {
      const a = (i - f) * geom.step
      const x = geom.Cx + sign * geom.R * Math.cos(a)
      const y = geom.Cy + geom.R * Math.sin(a)
      const dist = Math.abs(i - f)
      const it = nodes[i]
      it.style.left = x + 'px'
      it.style.top = y + 'px'
      it.style.opacity = String(Math.max(0.10, 1 - dist * 0.42))
      it.style.transform = `translate(-50%, -50%) scale(${Math.max(0.62, 1 - dist * 0.14)})`
      it.classList.toggle('on', Math.round(f) === i)
    }
  }

  function layout() { measure(); placeItems(active) }
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
  // First placement must not animate: items would otherwise fly in from 0,0.
  stage.classList.add('dragging')
  layout() // immediate (rAF may be throttled when the tab isn't visible)
  requestAnimationFrame(() => { layout(); stage.classList.remove('dragging') })

  return { stage, setActive, layout, getActive: () => active, destroy: () => ro.disconnect() }
}
