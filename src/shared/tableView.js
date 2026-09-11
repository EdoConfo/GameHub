import { el } from './ui.js'
import { avatar, emptyAvatar } from '../hub/players.js'

const SVGNS = 'http://www.w3.org/2000/svg'
const TAU = Math.PI * 2
const BASE = 56 // a seat at full size (px)…
const MIN = 26  // …down to this for a big group, so the ring still shows between seats

// Seat 0 is always at the bottom — whoever holds the phone, facing the screen —
// and the rest follow clockwise: 3 seats make a triangle pointing down, 4 a
// diamond, 5 an upside-down pentagon. The host builds the table from there.
const START = Math.PI / 2
const slot = (i, n) => START + (i * TAU) / n
const wrap = a => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI // -> [-π, π)
const mod = (i, n) => ((i % n) + n) % n

// Seat size for n seats round a table of radius r: 62% of the distance to the
// next seat, so there's always ring left between them to grab and turn.
export function seatFor(r, n) {
  const room = n > 1 ? 2 * r * Math.sin(Math.PI / n) * 0.62 : BASE
  return Math.max(MIN, Math.min(BASE, room))
}

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
// the order the phone goes round; each name sits just outside its seat, on the
// same line from the centre. Seats glide along the circle (never across it)
// when they move, arrive or leave.
//   set(items)  items: [{ key, p: profile | null, name, note?, cls? }]
//   fit(geo)    geo: { cx, cy, r } in host px — instant; call per frame to animate
//   reveal(t)   seats fade and grow in with the table (0..1)
//   extent()    the biggest name label { w, h }: the room names need around the table
//   onTap(i)            tap a seat
//   onSwap(a, b)        drop a seat onto another: the two swap places
//   onMove(from, steps) drop a seat between two others: it moves `steps` places
//                       (+ clockwise), the seats it passed step back one
//   onRotate(k)         drag the table itself: it turns like a lazy Susan (a flick
//                       carries on) and settles with a seat at the bottom, k places on
//   onExtent()          the names changed size: the table may need other room
export function createTableView(host, { onTap, onSwap, onMove, onRotate, onExtent } = {}) {
  const movable = !!(onSwap || onMove)
  const layer = el('div', { class: 'table-view' + (movable ? ' movable' : '') + (onRotate ? ' spinnable' : '') })
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
  let extent = { w: 0, h: 0 }
  let raf = 0, last = 0
  let drag = null   // { seat } carrying a seat · { spin } turning the table
  let settle = null // the table coasting to a stop after it's let go
  let first = true  // the first seats arrive already seated (the table carries them in)

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
    const e = measure()
    if (Math.abs(e.w - extent.w) > 1 || Math.abs(e.h - extent.h) > 1) {
      extent = e
      if (onExtent) onExtent()
    }
  }

  // The biggest name label: the room names need around the table.
  function measure() {
    let w = 0, h = 0
    for (const s of seats) { w = Math.max(w, s.label.offsetWidth); h = Math.max(h, s.label.offsetHeight) }
    return { w, h }
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
    layer.style.setProperty('--seat-k', k.toFixed(3)) // names shrink with the seats
    const d = size * 0.55 + 7
    for (const s of leaving.length ? seats.concat(leaving) : seats) {
      const c = Math.cos(s.a), sn = Math.sin(s.a)
      const x = cx + r * c, y = cy + r * sn
      const vis = Math.max(0, Math.min(1, s.o * shown))
      s.node.style.opacity = vis
      s.node.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${k * (0.6 + 0.4 * vis)})`
      // the name: just outside the seat, pushed outwards along its radius
      s.label.style.opacity = vis
      s.label.style.transform = `translate(${x + c * d}px, ${y + sn * d}px) translate(${-50 + 50 * c}%, ${-50 + 50 * sn}%)`
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
    const ts = seatFor(geo.r, seats.length)
    if (Math.abs(ts - size) > 0.3) { size += (ts - size) * f; busy = true } else size = ts
    render()
    if ((busy || leaving.length) && !raf) raf = requestAnimationFrame(tick)
  }

  const angleAt = (e, rect) => Math.atan2(e.clientY - rect.top - geo.cy, e.clientX - rect.left - geo.cx)

  // ---- a seat: tap it, or carry it round the table. Nobody moves while it's
  // carried. Dropped onto another seat, the two swap; dropped between two
  // seats, it goes in there and the seats it passed each step back one to close
  // the gap it left. Everyone else stays put.
  function grab(e, s) {
    if ((!onTap && !movable) || drag || settle) return
    e.preventDefault()
    const rect = layer.getBoundingClientRect()
    drag = { seat: s, sx: e.clientX, sy: e.clientY, moved: false, from: seats.indexOf(s), rect, last: angleAt(e, rect), travel: 0, aim: null, key: '' }
    follow(e, ev => drift(ev, s), cancelled => drop(s, cancelled))
  }
  // Where the carried seat would land, from how far it has travelled (in seats):
  // close to a seat = onto it (swap); in between = into that gap (insert).
  function aimOf(g) {
    const n = seats.length
    const t = g.travel / (TAU / n)
    const j = Math.round(t)
    if (onSwap && j !== 0 && Math.abs(t - j) < 0.3) {
      const to = mod(g.from + j, n)
      return to === g.from ? null : { swap: to }
    }
    const k = Math.min(n - 1, Math.floor(Math.abs(t)))
    return onMove && k ? { dir: Math.sign(t), k } : null
  }
  // swap: the seat it's over lights up · insert: the two it would land between
  function showAim(g, on) {
    const a = g.aim
    if (!a) return
    const n = seats.length
    const marks = a.swap != null
      ? [[a.swap, 'swap']]
      : [[mod(g.from + a.dir * a.k, n), 'target'], [mod(g.from + a.dir * (a.k + 1), n), 'target']]
    for (const [i, cls] of marks) {
      const t = seats[i]
      if (t && t !== g.seat) { t.node.classList.toggle(cls, on); t.label.classList.toggle(cls, on) }
    }
  }
  function drift(e, s) {
    if (!drag || drag.seat !== s) return
    if (!drag.moved) {
      if (!movable || seats.length < 2 || Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 8) return
      drag.moved = true
      s.node.classList.add('lifted')
    }
    // near the centre the angle is meaningless: hold still there
    if (Math.hypot(e.clientX - drag.rect.left - geo.cx, e.clientY - drag.rect.top - geo.cy) < 24) return
    const a = angleAt(e, drag.rect)
    drag.travel += wrap(a - drag.last)
    drag.last = a
    s.a = slot(drag.from, seats.length) + drag.travel // it rides the circle with the finger
    const aim = aimOf(drag)
    const key = aim ? (aim.swap != null ? 's' + aim.swap : 'm' + aim.dir * aim.k) : ''
    if (key !== drag.key) { showAim(drag, false); drag.aim = aim; drag.key = key; showAim(drag, true) }
    render()
  }
  function drop(s, cancelled) {
    if (!drag || drag.seat !== s) return
    const d = drag
    drag = null
    s.node.classList.remove('lifted')
    showAim(d, false)
    if (d.moved) {
      const a = cancelled ? null : d.aim
      const n = seats.length
      if (a && a.swap != null) {
        const other = seats[a.swap]
        seats[a.swap] = s
        seats[d.from] = other
        s.ta = slot(a.swap, n)
        other.ta = slot(d.from, n)
        onSwap(d.from, a.swap)
      } else if (a) {
        let p = d.from
        for (let i = 0; i < a.k; i++) {
          const q = mod(p + a.dir, n)
          seats[p] = seats[q]
          seats[p].ta = slot(p, n)
          p = q
        }
        seats[p] = s
        s.ta = slot(p, n)
        onMove(d.from, a.dir * a.k)
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
    const k = mod(Math.round(to / step), n)
    const next = new Array(n)
    order.forEach((s, i) => { next[(i + k) % n] = s })
    seats = next
    seats.forEach((s, i) => { s.a = s.ta = slot(i, n) })
    if (k) onRotate(k)
  }

  function fit(g) {
    geo = { cx: g.cx, cy: g.cy, r: g.r }
    size = seatFor(geo.r, seats.length)
    center.hidden = geo.r < 64 // a tiny table keeps its middle clear
    render()
  }
  function reveal(t) { shown = t; render() }
  function setCenter(node) { center.replaceChildren(...(node ? [node] : [])) }
  function destroy() { cancelAnimationFrame(raf); raf = 0; drag = null; settle = null; layer.remove() }

  return { layer, set, fit, reveal, setCenter, destroy, extent: () => extent, count: () => seats.length }
}
