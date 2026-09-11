import { el } from './ui.js'
import { avatar, emptyAvatar } from '../hub/players.js'

const SVGNS = 'http://www.w3.org/2000/svg'
const TAU = Math.PI * 2
const BASE = 56 // a seat at full size (px); crowded or small tables scale it down

// Seat 0 is always at the bottom — whoever holds the phone, facing the screen —
// and the rest follow clockwise: 3 seats make a triangle pointing down, 4 a
// diamond, 5 an upside-down pentagon. The host builds the table from there.
const START = Math.PI / 2
const slot = (i, n) => START + (i * TAU) / n
const wrap = a => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI // -> [-π, π)

// Follow a finger on the whole window until it lifts: it may leave the seat or
// the table, and iOS doesn't always keep pointer capture.
function follow(e, move, end) {
  const id = e.pointerId
  const onMove = ev => { if (ev.pointerId === id) move(ev) }
  const onEnd = ev => {
    if (ev.pointerId !== id) return
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onEnd)
    window.removeEventListener('pointercancel', onEnd)
    end(ev.type === 'pointercancel')
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onEnd)
  window.addEventListener('pointercancel', onEnd)
}

// The table seen from above. Seats are threaded on the circle like beads, in
// the order the phone goes round; each name lies on the table in front of its
// seat, like a place card. Seats glide along the circle (never across it)
// when they move, arrive or leave.
//   set(items)  items: [{ key, p: profile | null, name, note?, cls? }]
//   fit(geo)    geo: { cx, cy, r } in host px — instant; call per frame to animate
//   reveal(t)   seats fade and grow in with the table (0..1)
//   onTap(i)          tap a seat
//   onMove(from, steps) drag a seat between two others: it moves `steps` places
//                     (+ clockwise), the seats it passed step back one to close
//                     the gap; nobody else moves
//   onRotate(k)       drag the table itself: it turns like a lazy Susan (a flick
//                     carries on) and settles with a seat at the bottom, k places on
export function createTableView(host, { onTap, onMove, onRotate } = {}) {
  const layer = el('div', { class: 'table-view' + (onMove ? ' movable' : '') + (onRotate ? ' spinnable' : '') })
  const svg = document.createElementNS(SVGNS, 'svg')
  svg.setAttribute('class', 'table-svg')
  const ring = document.createElementNS(SVGNS, 'circle')
  ring.setAttribute('class', 'arc-line')
  const ticks = document.createElementNS(SVGNS, 'path')
  ticks.setAttribute('class', 'table-ticks')
  svg.append(ring, ticks)
  // The table top, under the seats: grab it to turn the table. An HTML disc,
  // not SVG — iOS only reliably honours touch-action (no page scroll) on HTML.
  const pad = el('div', { class: 'table-pad' })
  const center = el('div', { class: 'table-center' })
  layer.append(svg, pad, center)
  host.append(layer)

  let geo = { cx: 0, cy: 0, r: 0 }
  let shown = 1
  let seats = []   // { key, node, label, a, ta, o, to } in table order
  let leaving = [] // removed seats, fading out
  let size = BASE
  let raf = 0, last = 0
  let drag = null   // { seat } carrying a seat · { spin } turning the table
  let settle = null // the table coasting to a stop after it's let go
  let first = true  // the first seats arrive already seated (the table carries them in)

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
    settle = null // new seats win over a table still coasting: they ease to their chairs
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
    const pr = Math.max(0, r + size / 2)
    pad.style.width = pad.style.height = 2 * pr + 'px'
    pad.style.transform = `translate(${cx - pr}px, ${cy - pr}px)`
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
  // They turn with the table; while a seat is carried around they step aside.
  function drawTicks() {
    const n = seats.length
    if (n < 2 || (drag && drag.moved && drag.seat)) { ticks.setAttribute('d', ''); return }
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
    if (settle) {
      const p = Math.min(1, (now - settle.t0) / settle.ms)
      settle.now = settle.from + (settle.to - settle.from) * (1 - Math.pow(1 - p, 3))
      settle.order.forEach((s, i) => { s.a = settle.base[i] + settle.now })
      if (p >= 1) stopped()
      busy = true
    }
    for (const s of seats) {
      if (settle || (drag && drag.moved && (drag.spin || drag.seat === s))) continue // held or coasting
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
    if ((busy || leaving.length) && !raf) raf = requestAnimationFrame(tick)
  }

  const angleAt = (e, rect) => Math.atan2(e.clientY - rect.top - geo.cy, e.clientX - rect.left - geo.cx)

  // ---- a seat: tap it, or carry it round the table and drop it between two
  // others. Nobody moves while it's carried; on drop it takes the place of the
  // last seat it passed, and the seats it passed each step back one to close
  // the gap it left. Everyone else stays where they are.
  function grab(e, s) {
    if ((!onTap && !onMove) || drag || settle) return
    e.preventDefault()
    const rect = layer.getBoundingClientRect()
    drag = { seat: s, sx: e.clientX, sy: e.clientY, moved: false, from: seats.indexOf(s), rect, last: angleAt(e, rect), travel: 0, k: 0, dir: 0 }
    follow(e, ev => drift(ev, s), cancelled => drop(s, cancelled))
  }
  // the two seats it would land between (none until it has passed one)
  function markGap(g, on) {
    const n = seats.length
    if (!g.k) return
    for (const j of [g.k, g.k + 1]) {
      const t = seats[(((g.from + g.dir * j) % n) + n) % n]
      if (t && t !== g.seat) t.node.classList.toggle('target', on)
    }
  }
  function drift(e, s) {
    if (!drag || drag.seat !== s) return
    if (!drag.moved) {
      if (!onMove || seats.length < 2 || Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 8) return
      drag.moved = true
      s.node.classList.add('lifted')
    }
    // near the centre the angle is meaningless: hold still there
    if (Math.hypot(e.clientX - drag.rect.left - geo.cx, e.clientY - drag.rect.top - geo.cy) < 24) return
    const a = angleAt(e, drag.rect)
    drag.travel += wrap(a - drag.last)
    drag.last = a
    const n = seats.length
    s.a = slot(drag.from, n) + drag.travel // it rides the circle with the finger
    // how many seats it has passed, and which way (+1 = clockwise)
    const t = drag.travel / (TAU / n)
    const k = Math.min(n - 1, Math.floor(Math.abs(t))), dir = Math.sign(t)
    if (k !== drag.k || dir !== drag.dir) { markGap(drag, false); drag.k = k; drag.dir = dir; markGap(drag, true) }
    render()
  }
  function drop(s, cancelled) {
    if (!drag || drag.seat !== s) return
    const d = drag
    drag = null
    s.node.classList.remove('lifted')
    markGap(d, false)
    if (d.moved) {
      if (!cancelled && d.k) {
        const n = seats.length
        let p = d.from
        for (let i = 0; i < d.k; i++) {
          const q = (p + d.dir + n) % n
          seats[p] = seats[q]
          seats[p].ta = slot(p, n)
          p = q
        }
        seats[p] = s
        s.ta = slot(p, n)
        onMove(d.from, d.dir * d.k)
      }
      kick() // into its chair: the new one, or back to its own
    } else if (!cancelled && onTap) onTap(seats.indexOf(s))
  }

  // ---- the table top: drag it round to turn the whole table ----
  pad.addEventListener('pointerdown', e => {
    if (!onRotate || drag || seats.length < 2) return
    e.preventDefault()
    const rect = layer.getBoundingClientRect()
    const n = seats.length
    // caught while still coasting: carry on from where it is
    const turn = settle ? settle.now : 0
    settle = null
    drag = { spin: true, rect, sx: e.clientX, sy: e.clientY, moved: false, last: angleAt(e, rect), turn, base: seats.map((_, i) => slot(i, n)), trail: [] }
    follow(e, spinMove, spinEnd)
  })
  function spinMove(e) {
    if (!drag || !drag.spin) return
    if (!drag.moved) {
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return
      drag.moved = true
      layer.classList.add('spinning')
    }
    // near the centre the angle is meaningless: hold still there
    if (Math.hypot(e.clientX - drag.rect.left - geo.cx, e.clientY - drag.rect.top - geo.cy) < 24) return
    const a = angleAt(e, drag.rect)
    drag.turn += wrap(a - drag.last)
    drag.last = a
    const now = performance.now()
    drag.trail.push({ t: now, turn: drag.turn })
    while (drag.trail.length > 2 && now - drag.trail[0].t > 100) drag.trail.shift()
    seats.forEach((s, i) => { s.a = drag.base[i] + drag.turn })
    render()
  }
  function spinEnd() {
    if (!drag || !drag.spin) return
    const d = drag
    drag = null
    layer.classList.remove('spinning')
    if (!d.moved && !d.turn) return
    // A flick carries on, as if the table had weight; an ordinary drag (slower,
    // or stopped before letting go) just settles on the nearest chair.
    const n = seats.length, step = TAU / n, now = performance.now()
    let aim = d.turn
    const tr = d.trail
    if (tr.length > 1 && now - tr[tr.length - 1].t < 90) {
      const a = tr[0], b = tr[tr.length - 1]
      const v = (b.turn - a.turn) / Math.max(16, b.t - a.t) // rad/ms
      const flick = Math.max(0, Math.abs(v) - 0.004) * 250
      aim += Math.sign(v) * Math.min(TAU, flick)
    }
    const to = Math.round(aim / step) * step
    const ms = Math.min(1100, Math.max(280, Math.abs(to - d.turn) * 420))
    settle = { t0: now, ms, from: d.turn, to, now: d.turn, base: d.base, order: seats.slice(), step }
    kick()
  }
  // Stopped on a chair: every seat moved k places, order unchanged.
  function stopped() {
    const { order, to, step } = settle
    settle = null
    const n = order.length
    const k = ((Math.round(to / step) % n) + n) % n
    const next = new Array(n)
    order.forEach((s, i) => { next[(i + k) % n] = s })
    seats = next
    seats.forEach((s, i) => { s.a = s.ta = slot(i, n) })
    if (k) onRotate(k)
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
  function destroy() { cancelAnimationFrame(raf); raf = 0; drag = null; settle = null; layer.remove() }

  return { layer, set, fit, reveal, setCenter, destroy }
}
