import { el } from './ui.js'
import { avatar, emptyAvatar } from '../hub/players.js'

const SVGNS = 'http://www.w3.org/2000/svg'
const TAU = Math.PI * 2
const BASE = 56 // a seat at full size (px); crowded or small tables scale it down

const slot = (i, n) => -Math.PI / 2 + (i * TAU) / n
const wrap = a => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI // -> [-π, π)

// The table seen from above. Seats are threaded on the circle like beads,
// clockwise from the top in the order the phone goes round; each name lies on
// the table in front of its seat, like a place card. Seats glide along the
// circle (never across it) when they move, arrive or leave.
//   set(items)  items: [{ key, p: profile | null, name, note?, cls? }]
//   fit(geo)    geo: { cx, cy, r } in host px — instant; call per frame to animate
//   reveal(t)   seats fade and grow in with the table (0..1)
//   onTap(i), onMove(from, to): optional — make seats tappable / draggable
export function createTableView(host, { onTap, onMove } = {}) {
  const layer = el('div', { class: 'table-view' + (onMove ? ' movable' : '') })
  const svg = document.createElementNS(SVGNS, 'svg')
  svg.setAttribute('class', 'table-svg')
  const ring = document.createElementNS(SVGNS, 'circle')
  ring.setAttribute('class', 'arc-line')
  const ticks = document.createElementNS(SVGNS, 'path')
  ticks.setAttribute('class', 'table-ticks')
  svg.append(ring, ticks)
  const center = el('div', { class: 'table-center' })
  layer.append(svg, center)
  host.append(layer)

  let geo = { cx: 0, cy: 0, r: 0 }
  let shown = 1
  let seats = []   // { key, node, label, a, ta, o, to } in table order
  let leaving = [] // removed seats, fading out
  let size = BASE
  let raf = 0, last = 0
  let drag = null
  let first = true // the first seats arrive already seated (the table carries them in)

  function seatSize() {
    const n = seats.length
    const room = n > 1 ? 2 * geo.r * Math.sin(Math.PI / n) * 0.62 : BASE
    return Math.max(32, Math.min(BASE, room))
  }

  function makeSeat(key) {
    const s = { key, a: 0, ta: 0, o: 0, to: 1 }
    s.node = el('button', { class: 'seat' })
    s.label = el('div', { class: 'seat-label' })
    s.node.addEventListener('pointerdown', e => grab(e, s))
    s.node.addEventListener('pointermove', e => drift(e, s))
    s.node.addEventListener('pointerup', () => drop(s))
    s.node.addEventListener('pointercancel', () => drop(s, true))
    layer.append(s.node, s.label)
    return s
  }

  function paint(s, it) {
    const cls = (it.p ? '' : ' free') + (it.cls ? ' ' + it.cls : '')
    s.node.className = 'seat' + cls
    s.node.setAttribute('aria-label', it.p ? it.name : 'Posto libero')
    s.node.replaceChildren(it.p ? avatar(it.p, BASE) : emptyAvatar(BASE))
    s.label.className = 'seat-label' + cls
    s.label.replaceChildren(...[
      el('span', { class: 'seat-name' }, it.name || ''),
      it.note ? el('span', { class: 'seat-note' }, it.note) : null
    ].filter(Boolean))
  }

  function set(items) {
    const old = new Map(seats.map(s => [s.key, s]))
    const n = items.length
    seats = items.map((it, i) => {
      let s = old.get(it.key)
      if (s) old.delete(it.key)
      else { s = makeSeat(it.key); s.a = slot(i, n); s.o = first ? 1 : 0 }
      s.ta = slot(i, n)
      s.to = 1
      paint(s, it)
      return s
    })
    for (const s of old.values()) { s.to = 0; leaving.push(s) }
    first = false
    render()
    kick()
  }

  function render() {
    const { cx, cy, r } = geo
    ring.setAttribute('cx', cx)
    ring.setAttribute('cy', cy)
    ring.setAttribute('r', Math.max(0, r))
    const k = size / BASE
    const d = size / 2 + 11
    for (const s of leaving.length ? seats.concat(leaving) : seats) {
      const c = Math.cos(s.a), sn = Math.sin(s.a)
      const x = cx + r * c, y = cy + r * sn
      const vis = Math.max(0, Math.min(1, s.o * shown))
      s.node.style.opacity = vis
      s.node.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${k * (0.6 + 0.4 * vis)})`
      // place card: on the table, in front of its seat
      s.label.style.opacity = vis
      s.label.style.transform = `translate(${x - c * d}px, ${y - sn * d}px) translate(${-50 - 50 * c}%, ${-50 - 50 * sn}%)`
    }
    drawTicks()
    center.style.opacity = shown
    center.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`
  }

  // Small chevrons on the line between neighbours: the way the phone goes.
  function drawTicks() {
    const n = seats.length
    if (n < 2 || (drag && drag.moved)) { ticks.setAttribute('d', ''); return }
    const { cx, cy, r } = geo
    const h = 3.4
    let d = ''
    for (let i = 0; i < n; i++) {
      const a1 = seats[i].a, a2 = seats[(i + 1) % n].a
      const m = a1 + ((((a2 - a1) % TAU) + TAU) % TAU) / 2
      const x = cx + r * Math.cos(m), y = cy + r * Math.sin(m)
      const tx = -Math.sin(m), ty = Math.cos(m) // clockwise on screen
      const nx = Math.cos(m), ny = Math.sin(m)
      d += `M${x - tx * h * 0.7 + nx * h} ${y - ty * h * 0.7 + ny * h}` +
        `L${x + tx * h * 0.7} ${y + ty * h * 0.7}` +
        `L${x - tx * h * 0.7 - nx * h} ${y - ty * h * 0.7 - ny * h}`
    }
    ticks.setAttribute('d', d)
    ticks.style.opacity = shown
  }

  // Seats ease towards their chairs (angle, visibility) — exponential approach,
  // so any interruption just continues from where they are.
  function kick() {
    if (raf) return
    last = performance.now()
    raf = requestAnimationFrame(tick)
  }
  function tick(now) {
    raf = 0
    if (!layer.isConnected) return
    const f = 1 - Math.exp(-Math.min(64, now - last) / 95)
    last = now
    let busy = false
    for (const s of seats) {
      if (drag && drag.moved && drag.seat === s) continue
      const da = wrap(s.ta - s.a)
      if (Math.abs(da) > 0.0008) { s.a += da * f; busy = true } else s.a = s.ta
      const dO = s.to - s.o
      if (Math.abs(dO) > 0.004) { s.o += dO * f; busy = true } else s.o = s.to
    }
    leaving = leaving.filter(s => {
      s.o -= s.o * f
      if (s.o > 0.01) return true
      s.node.remove(); s.label.remove()
      return false
    })
    const ts = seatSize()
    if (Math.abs(ts - size) > 0.3) { size += (ts - size) * f; busy = true } else size = ts
    render()
    if (busy || leaving.length) raf = requestAnimationFrame(tick)
  }

  // ---- tap / drag a seat round the table ----
  function grab(e, s) {
    if (!onTap && !onMove) return
    e.preventDefault()
    try { s.node.setPointerCapture(e.pointerId) } catch { /* not capturable */ }
    const i = seats.indexOf(s)
    drag = { seat: s, sx: e.clientX, sy: e.clientY, moved: false, from: i, to: i, rect: layer.getBoundingClientRect() }
  }
  function drift(e, s) {
    if (!drag || drag.seat !== s) return
    if (!drag.moved) {
      if (!onMove || seats.length < 2 || Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 8) return
      drag.moved = true
      s.node.classList.add('lifted')
    }
    s.a = Math.atan2(e.clientY - drag.rect.top - geo.cy, e.clientX - drag.rect.left - geo.cx)
    const n = seats.length
    const to = Math.round(((((s.a + Math.PI / 2) % TAU) + TAU) % TAU) / (TAU / n)) % n
    if (to !== drag.to) {
      drag.to = to
      const others = seats.filter(o => o !== s)
      others.splice(to, 0, s)
      seats = others
      seats.forEach((o, i) => { o.ta = slot(i, n) })
    }
    render()
    kick()
  }
  function drop(s, cancelled = false) {
    if (!drag || drag.seat !== s) return
    const d = drag
    drag = null
    s.node.classList.remove('lifted')
    if (d.moved) {
      kick() // settles into its chair
      if (d.to !== d.from && onMove) onMove(d.from, d.to)
    } else if (!cancelled && onTap) onTap(seats.indexOf(s))
  }

  function fit(g) {
    geo = { cx: g.cx, cy: g.cy, r: g.r }
    size = seatSize()
    const labelW = geo.r - size / 2 - 40
    layer.style.setProperty('--label-w', Math.max(54, labelW) + 'px')
    // a small table has no room left in the middle once the place cards are down
    center.hidden = labelW < 62
    render()
  }
  function reveal(t) { shown = t; render() }
  function setCenter(node) { center.replaceChildren(...(node ? [node] : [])) }
  function destroy() { cancelAnimationFrame(raf); raf = 0; layer.remove() }

  return { layer, set, fit, reveal, setCenter, destroy }
}
