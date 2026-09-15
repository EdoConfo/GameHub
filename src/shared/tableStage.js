import { el } from './ui.js'
import { t } from './i18n.js'
import { createTableView, seatFor } from './tableView.js'

// cubic-bezier(x1, y1, x2, y2) as a function of progress — same curves as CSS.
function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
  const x = t => ((ax * t + bx) * t + cx) * t
  const dx = t => (3 * ax * t + 2 * bx) * t + cx
  const y = t => ((ay * t + by) * t + cy) * t
  return p => {
    let t = p
    for (let i = 0; i < 8; i++) {
      const err = x(t) - p, d = dx(t)
      if (Math.abs(err) < 1e-5 || Math.abs(d) < 1e-6) break
      t -= err / d
    }
    return y(Math.max(0, Math.min(1, t)))
  }
}
// The camera's curve (--pan-ease): the table moves like everything else.
const ease = bezier(0.4, 0, 0.18, 1)
const smooth = (a, b, t) => { const k = Math.max(0, Math.min(1, (t - a) / (b - a || 1))); return k * k * (3 - 2 * k) }

// How long the table takes to fold away. Whoever animates alongside it (the
// hub's menu wheel) reads it from here instead of guessing the same number.
export const TABLE_CLOSE_MS = 640

// Where the table and the drawer last were. The next stage (another screen)
// starts from there, so moving between screens the table glides, never jumps.
let lastGeo = null
let lastDrawer = 0

// A table stage: the table in the upper part of the host, a drawer below with
// whatever this moment needs. The table takes the room the drawer leaves;
// when the drawer changes, the table glides to its new place.
//   top(): px from the host's top where the room starts (under the header)
//   from:  { cx, cy, r } to start the table from (default: where it last was)
//   shown: initial seat visibility (0 = seats still to appear)
export function createTableStage(host, { top, from, shown: shown0 = 1, onTap, onSwap, onMove, onRotate } = {}) {
  const layer = el('div', { class: 'table-layer' })
  const handle = el('button', { class: 'drawer-handle', 'aria-label': t('table.drawerToggle') })
  const body = el('div', { class: 'drawer-body' })
  const drawer = el('div', { class: 'drawer' }, [handle, body])
  // A second panel that rises OVER the drawer, for one thing at a time (roles,
  // word packs). It covers the drawer whole — never a strip of it peeking out
  // above — and its handle has one meaning: drag it down and it's gone.
  const sheetHandle = el('button', { class: 'drawer-handle', 'aria-label': t('table.sheetClose') })
  const sheetBody = el('div', { class: 'drawer-body' })
  const sheet = el('div', { class: 'drawer sheet' }, [sheetHandle, sheetBody])
  // Everything outside the sheet is a way out of it: touching the table closes
  // the sheet, and that same touch does nothing else. You're back on the
  // drawer, with the table live again — a second tap moves a seat.
  const scrim = el('div', { class: 'sheet-scrim' })
  scrim.addEventListener('pointerdown', () => closeSheet())
  host.append(layer, drawer, scrim, sheet)
  // the names changed size (new seats, notes): make the room they need
  const view = createTableView(layer, { onTap, onSwap, onMove, onRotate, onExtent: () => reflow() })

  let geo = null
  let shown = shown0
  let raf = 0
  let hTimer = 0
  let isOpen = false
  let sheetOpen = false
  let sheetDone = null
  let sheetTimer = 0
  let size = host.clientWidth + 'x' + host.clientHeight

  function place(g, s = shown) {
    geo = g
    shown = s
    view.fit(g)
    view.reveal(s)
    lastGeo = g
  }
  const start = from || lastGeo
  if (start) place(start, shown0)

  // The room above the drawer; the table takes it, centred. Names sit outside
  // the seats, so they get room at the sides and above/below. Seat size
  // depends on the radius, hence a couple of rounds to settle it.
  // Only the drawer shapes the table's room. The sheet passes OVER the table
  // instead of pushing it: it can grow with the roles and the packs it holds,
  // and a table that shrank to a button every time one opened would be worse
  // than a table temporarily covered.
  function room(drawerH = isOpen ? drawer.offsetHeight : 0) {
    const W = host.clientWidth, H = host.clientHeight
    const t = top ? top() : 0
    const b = H - drawerH
    const e = view.extent(), n = view.count()
    let r = Math.min(W, b - t) / 2
    for (let i = 0; i < 3; i++) {
      const out = seatFor(r, n) * 0.55 + 7 // seat edge to name, as the view draws it
      r = Math.min(W / 2 - out - e.w - 8, (b - t) / 2 - out - e.h - 6)
    }
    return { cx: W / 2, cy: t + (b - t) / 2, r: Math.max(48, r) }
  }

  function reflow() { if (isOpen && geo && !raf) glide(room(), { ms: 360 }) }

  // Tween the table to `to`; seats reach visibility `shown` within `span`.
  function glide(to, { ms = 440, shown: s1 = 1, span = [0, 1], done } = {}) {
    cancelAnimationFrame(raf)
    raf = 0
    if (!geo || ms <= 0) { place(to, s1); if (done) done(); return }
    const g0 = geo, s0 = shown, t0 = performance.now()
    const step = now => {
      if (!layer.isConnected) return
      const p = Math.min(1, (now - t0) / ms), e = ease(p)
      place({
        cx: g0.cx + (to.cx - g0.cx) * e,
        cy: g0.cy + (to.cy - g0.cy) * e,
        r: g0.r + (to.r - g0.r) * e
      }, s0 + (s1 - s0) * smooth(span[0], span[1], p))
      if (p < 1) raf = requestAnimationFrame(step)
      else { raf = 0; if (done) done() }
    }
    raf = requestAnimationFrame(step)
  }

  // Change the drawer (content or folded state): its height morphs and the
  // table glides into the room it leaves.
  function morph(mutate, animate = true) {
    const h0 = drawer.offsetHeight
    clearTimeout(hTimer)
    drawer.style.height = ''
    mutate()
    const h1 = drawer.offsetHeight
    if (!isOpen) return h1
    lastDrawer = h1
    if (animate && Math.abs(h1 - h0) > 1) {
      drawer.style.height = h0 + 'px'
      void drawer.offsetHeight // commit the start height
      drawer.style.height = h1 + 'px'
      hTimer = setTimeout(() => { drawer.style.height = '' }, 420)
    }
    glide(room(h1), { ms: animate ? 440 : 0 })
    return h1
  }

  function setDrawer(node, animate = true) {
    morph(() => {
      body.replaceChildren(node)
      handle.hidden = !body.querySelector('.drawer-more')
    }, animate)
    if (animate && isOpen) {
      body.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
        { duration: 260, easing: 'ease-out' })
    }
  }

  // The drawer comes in sliding up from the bottom — or, when the previous
  // screen had one, it starts at that height and settles: the same drawer.
  function open({ slide = true } = {}) {
    const h1 = drawer.offsetHeight
    if (isOpen) return h1
    isOpen = true
    if (slide || !lastDrawer) {
      drawer.classList.add('open')
    } else {
      drawer.classList.add('open', 'instant')
      drawer.style.height = lastDrawer + 'px'
      void drawer.offsetHeight
      drawer.classList.remove('instant')
      drawer.style.height = h1 + 'px'
      hTimer = setTimeout(() => { drawer.style.height = '' }, 420)
    }
    lastDrawer = h1
    return h1
  }

  // Show `node` in the drawer; the first time, bring the drawer in too.
  function present(node) {
    if (isOpen) { setDrawer(node); return }
    setDrawer(node, false)
    const h = open({ slide: !lastDrawer })
    glide(room(h), { ms: geo ? 440 : 0 })
  }

  // Show `node` on the sheet, over the drawer. Opening it also takes the table
  // out of play: there's nothing to tap at on it from in here, and a tap that
  // opened a page hidden underneath would only be confusing.
  //   done: called when the sheet closes, however it was closed
  function openSheet(node, { done } = {}) {
    clearTimeout(sheetTimer)
    sheetDone = done || null
    sheetBody.replaceChildren(node)
    if (!sheetOpen) {
      sheetOpen = true
      layer.classList.add('blocked')
      scrim.classList.add('on')
      // at least as tall as what it hides, so the drawer never peeks above it
      sheet.style.minHeight = (isOpen ? drawer.offsetHeight : 0) + 'px'
      sheet.classList.add('open')
    }
    node.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
      { duration: 260, easing: 'ease-out' })
  }

  function closeSheet() {
    if (!sheetOpen) return
    sheetOpen = false
    sheet.classList.remove('open')
    layer.classList.remove('blocked')
    scrim.classList.remove('on')
    const fn = sheetDone
    sheetDone = null
    // empty it only once it's off screen, so it doesn't blink on the way down
    clearTimeout(sheetTimer)
    sheetTimer = setTimeout(() => { if (!sheetOpen) sheetBody.replaceChildren() }, 600)
    if (fn) fn()
  }

  // Drawer goes down, seats fade, the table glides to `to`; then it's gone.
  function close(to, done) {
    isOpen = false
    closeSheet()
    drawer.classList.remove('open')
    glide(to, { ms: TABLE_CLOSE_MS, shown: 0, span: [0, 0.5], done: () => { destroy(); if (done) done() } })
  }

  function refit() {
    const now = host.clientWidth + 'x' + host.clientHeight
    if (raf || now === size) return
    size = now
    if (geo && isOpen) place(room())
  }

  // Pull the handle down to fold the drawer (the table grows), up to unfold.
  let hy = null
  handle.addEventListener('pointerdown', e => {
    hy = e.clientY
    try { handle.setPointerCapture(e.pointerId) } catch { /* not capturable */ }
  })
  handle.addEventListener('pointerup', e => {
    if (hy == null) return
    const dy = e.clientY - hy
    hy = null
    const min = drawer.classList.contains('min')
    const next = dy > 20 ? true : dy < -20 ? false : !min
    if (next !== min) morph(() => drawer.classList.toggle('min', next))
  })
  handle.addEventListener('pointercancel', () => { hy = null })

  // The sheet's handle doesn't fold anything: down (or a plain tap) closes it.
  let sy = null
  sheetHandle.addEventListener('pointerdown', e => {
    sy = e.clientY
    try { sheetHandle.setPointerCapture(e.pointerId) } catch { /* not capturable */ }
  })
  sheetHandle.addEventListener('pointerup', e => {
    if (sy == null) return
    const dy = e.clientY - sy
    sy = null
    if (dy > -20) closeSheet()
  })
  sheetHandle.addEventListener('pointercancel', () => { sy = null })

  // The drawer changing height on its own hands the table back the room it
  // takes. The sheet is not watched: it doesn't own any of the table's room.
  const panels = new ResizeObserver(() => reflow())
  panels.observe(drawer)

  function destroy() {
    cancelAnimationFrame(raf)
    raf = 0
    clearTimeout(hTimer)
    clearTimeout(sheetTimer)
    panels.disconnect()
    view.destroy()
    layer.remove()
    drawer.remove()
    scrim.remove()
    sheet.remove()
  }

  return { view, room, glide, open, present, setDrawer, openSheet, closeSheet, close, refit, destroy }
}
