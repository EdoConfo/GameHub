// Small DOM helpers. No framework — just enough to keep screens readable.
import { t } from './i18n.js'

// el('div', { class:'card', onclick: fn }, [child, 'text'])
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue
    if (k === 'class') node.className = v
    else if (k === 'html') node.innerHTML = v
    else if (k === 'dataset') Object.assign(node.dataset, v)
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v)
    } else if (k === 'disabled' || k === 'checked' || k === 'selected') {
      if (v) node.setAttribute(k, '')
    } else {
      node.setAttribute(k, v)
    }
  }
  const kids = Array.isArray(children) ? children : [children]
  for (const c of kids) {
    if (c == null || c === false) continue
    node.append(c.nodeType ? c : document.createTextNode(String(c)))
  }
  return node
}

export function clear(node) {
  node.replaceChildren()
  return node
}

// Line icons — same minimal stroke style as the rest of the UI (no emoji).
// 24×24 viewBox, currentColor stroke; size/color follow the parent button.
const ICON_PATHS = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  forward: '<path d="M9 5l7 7-7 7"/>',
  // games
  incognito: '<path d="M3 11h18"/><path d="M6 11l1.5-5h9L18 11"/><circle cx="8" cy="16" r="2.5"/><circle cx="16" cy="16" r="2.5"/><path d="M10.5 16h3"/>',
  phone: '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>',
  // two answers to the same question, talking past each other
  bubbles: '<path d="M4.5 3.5h7a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H8l-3.5 2.8V11.5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2z"/><path d="M12.5 12.5h7a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2v2.6L15.5 19.5h-3a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2z"/>',
  // menu voices
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  words: '<path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.6-2.4 2.2-2.4 3.6"/><path d="M12 17h.01"/>',
  stats: '<path d="M5 20V11M12 20V5M19 20v-7"/>',
  // settings / players
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  offline: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8L3 12z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
  // appearance follows the system: a circle half filled in
  system: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none"/>',
  // language: a globe — one meridian, two parallels
  globe: '<circle cx="12" cy="12" r="9"/><path d="M12 3c2.5 2.4 3.8 5.4 3.8 9s-1.3 6.6-3.8 9c-2.5-2.4-3.8-5.4-3.8-9S9.5 5.4 12 3z"/><path d="M3.5 9h17M3.5 15h17"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  // a door you walk into: the room somebody else opened
  enter: '<path d="M14 4h3.5A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5H14"/><path d="M4 12h10"/><path d="M10.5 8.5L14 12l-3.5 3.5"/>',
  minus: '<path d="M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  // ---- pack icons: the same 24×24 line style, for naming a word pack ----
  dice: '<rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="9" cy="9" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="15" r="1.2" fill="currentColor" stroke="none"/>',
  paw: '<circle cx="7.4" cy="9.4" r="1.9"/><circle cx="12" cy="7.8" r="1.9"/><circle cx="16.6" cy="9.4" r="1.9"/><path d="M8.4 15.4c0-2 1.6-3.3 3.6-3.3s3.6 1.3 3.6 3.3c0 1.8-1.4 2.9-3.6 2.9s-3.6-1.1-3.6-2.9z"/>',
  food: '<path d="M7 3v6a2 2 0 0 0 4 0V3"/><path d="M9 9v12"/><path d="M16.5 21V3c2 1.2 3 3.2 3 5.5s-1 3.5-3 3.5"/>',
  film: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7.5 5v14M16.5 5v14"/><path d="M3 9.5h4.5M3 14.5h4.5M16.5 9.5H21M16.5 14.5H21"/>',
  // a pentagon with the seams running off it: a football, not another globe
  ball: '<circle cx="12" cy="12" r="9"/><path d="M12 7.4l3.4 2.5-1.3 4h-4.2l-1.3-4z"/><path d="M12 3v4.4M20 9.7l-4.6 2.2M17 19.6l-2.9-3.7M7 19.6l2.9-3.7M4 9.7l4.6 2.2"/>',
  mask: '<path d="M4.5 6h15v5a7.5 7.5 0 0 1-15 0z"/><circle cx="9.3" cy="11" r="1.1" fill="currentColor" stroke="none"/><circle cx="14.7" cy="11" r="1.1" fill="currentColor" stroke="none"/><path d="M9.6 15.2a3.4 3.4 0 0 0 4.8 0"/>',
  star: '<path d="M12 3.6l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.9l6-.8z"/>',
  music: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  bulb: '<path d="M9.5 17h5M10.5 20h3"/><path d="M12 3a6 6 0 0 0-3.4 10.9c.6.5.9 1.2.9 2h5c0-.8.3-1.5.9-2A6 6 0 0 0 12 3z"/>',
  bag: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7"/>',
  home: '<path d="M4 11l8-7 8 7"/><path d="M6.5 10v9h11v-9"/><path d="M10 19v-5h4v5"/>',
  car: '<path d="M4 16v-3l2-5h12l2 5v3"/><path d="M4 16h16"/><circle cx="8" cy="17.6" r="1.7"/><circle cx="16" cy="17.6" r="1.7"/>',
  plane: '<path d="M10.6 3.8a1.4 1.4 0 0 1 2.8 0V9l7 4v2l-7-2v3.4l2 1.4v1.6l-3.4-1-3.4 1v-1.6l2-1.4V13l-7 2v-2l7-4z"/>',
  gift: '<rect x="3.5" y="9" width="17" height="11" rx="2"/><path d="M3.5 13.5h17M12 9v11"/><path d="M12 9S9.6 4.2 7.7 5.6 9.2 9 12 9zm0 0s2.4-4.8 4.3-3.4S14.8 9 12 9z"/>',
  ghost: '<path d="M5 20V10.5a7 7 0 0 1 14 0V20l-2.3-1.6L14.3 20 12 18.4 9.7 20 7.3 18.4z"/><circle cx="9.6" cy="10.8" r="1.1" fill="currentColor" stroke="none"/><circle cx="14.4" cy="10.8" r="1.1" fill="currentColor" stroke="none"/>',
  robot: '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4.6V8"/><circle cx="12" cy="3.4" r="1.2"/><circle cx="9.2" cy="13" r="1.2" fill="currentColor" stroke="none"/><circle cx="14.8" cy="13" r="1.2" fill="currentColor" stroke="none"/><path d="M9.6 16.6h4.8"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5z"/>',
  flask: '<path d="M9 3h6"/><path d="M10 3v6.2L5.3 18a2 2 0 0 0 1.8 3h9.8a2 2 0 0 0 1.8-3L14 9.2V3"/><path d="M7.6 14.5h8.8"/>',
  palette: '<path d="M12 3a9 9 0 0 0 0 18c1.1 0 2-.8 2-1.8 0-.5-.2-.9-.5-1.2s-.5-.7-.5-1.2c0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8z"/><circle cx="8" cy="10.4" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="7.8" r="1.1" fill="currentColor" stroke="none"/><circle cx="16" cy="9.8" r="1.1" fill="currentColor" stroke="none"/>',
  heart: '<path d="M12 20S4.8 15.6 4.8 10.8A4 4 0 0 1 12 8a4 4 0 0 1 7.2 2.8C19.2 15.6 12 20 12 20z"/>',
  flame: '<path d="M12 3c3 4 6 5.6 6 9.5a6 6 0 0 1-12 0C6 9 8 7 12 3z"/><path d="M12 20a3 3 0 0 0 3-3c0-1.6-1.5-2.4-3-4.5-1.5 2.1-3 2.9-3 4.5a3 3 0 0 0 3 3z"/>',
  leaf: '<path d="M20 4C9.5 4 4 9.4 4 15.8 4 18.2 5.3 20 7 20.6 8.6 13.6 13.4 9.6 19.4 8.4"/><path d="M7 20.6C13.6 20.2 19.2 16 20 4"/>',

  // Goddess of Justice: a balance
  scales: '<path d="M12 3.5V20M8 20h8M4 7h16"/><path d="M4 7l-2.5 6a2.5 2.5 0 0 0 5 0z"/><path d="M20 7l-2.5 6a2.5 2.5 0 0 0 5 0z"/>',
  // two identical figures 5 apart; the back one keeps a constant 2.6 gap from the front one
  players: '<circle cx="9.5" cy="7.75" r="3.5"/><path d="M15.5 19.75v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5a3.5 3.5 0 0 0-3.5 3.5v1.5"/><path d="M14.5 4.25a3.5 3.5 0 0 1 0 7"/><path d="M20.5 19.75v-1.5a3.5 3.5 0 0 0-3.5-3.5"/>',
  // 8 identical teeth, 45° apart, same rounding on every tip and valley
  settings: '<circle cx="12" cy="12" r="3"/><path d="M9.09 4.99Q9.4 4.86 9.75 3.61L9.85 3.25Q10.3 1.64 12 1.64Q13.7 1.64 14.15 3.25L14.25 3.61Q14.6 4.86 14.91 4.99Q15.21 5.11 16.34 4.47L16.67 4.29Q18.12 3.47 19.33 4.67Q20.53 5.88 19.71 7.33L19.53 7.66Q18.89 8.79 19.01 9.09Q19.14 9.4 20.39 9.75L20.75 9.85Q22.36 10.3 22.36 12Q22.36 13.7 20.75 14.15L20.39 14.25Q19.14 14.6 19.01 14.91Q18.89 15.21 19.53 16.34L19.71 16.67Q20.53 18.12 19.33 19.33Q18.12 20.53 16.67 19.71L16.34 19.53Q15.21 18.89 14.91 19.01Q14.6 19.14 14.25 20.39L14.15 20.75Q13.7 22.36 12 22.36Q10.3 22.36 9.85 20.75L9.75 20.39Q9.4 19.14 9.09 19.01Q8.79 18.89 7.66 19.53L7.33 19.71Q5.88 20.53 4.67 19.33Q3.47 18.12 4.29 16.67L4.47 16.34Q5.11 15.21 4.99 14.91Q4.86 14.6 3.61 14.25L3.25 14.15Q1.64 13.7 1.64 12Q1.64 10.3 3.25 9.85L3.61 9.75Q4.86 9.4 4.99 9.09Q5.11 8.79 4.47 7.66L4.29 7.33Q3.47 5.88 4.67 4.67Q5.88 3.47 7.33 4.29L7.66 4.47Q8.79 5.11 9.09 4.99Z"/>'
}

export function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('class', 'icon')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '1.8')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  svg.setAttribute('aria-hidden', 'true')
  svg.innerHTML = ICON_PATHS[name] || ''
  return svg
}

// A full screen with an optional top bar (title + back action).
export function screen({ title, onBack, actions = [] } = {}) {
  const wrap = el('div', { class: 'screen' })
  if (title || onBack || actions.length) {
    const bar = el('header', { class: 'topbar' }, [
      onBack ? el('button', { class: 'icon-btn', 'aria-label': t('common.back'), onclick: onBack }, '‹') : el('span', { class: 'icon-btn ghost' }),
      el('h1', { class: 'topbar-title' }, title || ''),
      el('div', { class: 'topbar-actions' }, actions)
    ])
    wrap.append(bar)
  }
  const body = el('div', { class: 'screen-body' })
  wrap.append(body)
  wrap.body = body
  return wrap
}

export function button(label, opts = {}) {
  const { variant = 'primary', onClick, disabled = false, full = false } = opts
  return el('button', {
    class: `btn btn-${variant}${full ? ' btn-full' : ''}`,
    disabled,
    onclick: onClick
  }, label)
}

// Fading ends for a scrolling box — but only on the side there's something
// hidden. At the top of a list nothing is above it, so the first row stays
// plain; scroll down and it starts fading into the wall it's passing under.
// Same at the bottom. A box with nothing to scroll gets no walls at all.
//
// Watched and listened to, because a list grows and shrinks as people sit down
// and get up, and the sides change as it moves.
export function walls(box) {
  const check = () => {
    const room = box.scrollHeight - box.clientHeight
    box.classList.toggle('wall-top', room > 2 && box.scrollTop > 2)
    box.classList.toggle('wall-bottom', room > 2 && box.scrollTop < room - 2)
  }
  check()
  box.addEventListener('scroll', check, { passive: true })
  const ro = new ResizeObserver(check)
  ro.observe(box)
  for (const child of box.children) ro.observe(child)
  return box
}

// You can push a panel anywhere it isn't something you'd touch for its own
// sake: the grabber, yes, but also the empty space, the titles, the padding.
// Buttons, fields and scrolling lists keep their touches to themselves.
export const GRIP = '.drawer-handle, .modal-grip'
export const NO_DRAG = 'button, a, input, textarea, select, label, .list-scroll, .seat'

// -> 'grip' | 'body' | null (this touch isn't for dragging)
export function dragOrigin(e, { grip = GRIP, ignore = NO_DRAG } = {}) {
  const t = e.target
  if (!t || !t.closest) return null
  if (t.closest(grip)) return 'grip'
  return t.closest(ignore) ? null : 'body'
}

// Pull a panel down and it follows the finger; let go and it either leaves or
// springs back. Every panel in the app that can be dismissed uses this, so the
// gesture means the same thing everywhere.
//   zone:  where a push may start (usually the panel itself)
//   panel: what moves
//   onDismiss: called once, when the panel is meant to go
// A plain tap sends the panel away only from the grabber: tapping the middle of
// a page is not a way of asking for it to leave.
export function dragToDismiss(zone, panel, { onDismiss, part = 0.25, flick = 0.5 } = {}) {
  let from = null, t0 = 0, dy = 0, onGrip = false
  // --slide says how far down the panel has been pushed, as a part of itself:
  // the content fades along it, so nothing is ever left cut in half by the
  // edge of the screen, and coming back it returns as the panel returns.
  const move = px => {
    panel.style.transform = px ? `translateY(${px}px)` : ''
    panel.style.setProperty('--slide', (px / Math.max(1, panel.offsetHeight)).toFixed(3))
  }

  zone.addEventListener('pointerdown', e => {
    const where = dragOrigin(e)
    if (!where) return
    onGrip = where === 'grip'
    from = e.clientY
    t0 = performance.now()
    dy = 0
    panel.style.transition = 'none' // while the finger is down, no easing in the way
    panel.classList.add('sliding')
    try { zone.setPointerCapture(e.pointerId) } catch { /* not capturable */ }
  })
  zone.addEventListener('pointermove', e => {
    if (from == null) return
    dy = Math.max(0, e.clientY - from) // it only goes down: up is where it already is
    move(dy)
  })
  const end = e => {
    if (from == null) return
    const speed = dy / Math.max(1, performance.now() - t0) // px per ms
    from = null
    panel.style.transition = ''
    panel.classList.remove('sliding')
    move(0)
    if ((onGrip && dy < 4) || dy > panel.offsetHeight * part || speed > flick) onDismiss()
  }
  zone.addEventListener('pointerup', end)
  zone.addEventListener('pointercancel', end)
}

// A question, asked as a panel rising from the bottom over a blacked-out page.
// Three ways out, all the same one: the grabber (tapped or pulled down), the
// dark behind it, or one of the answers. Returns a controller with close().
export function modal({ title, content, actions = [] } = {}) {
  const overlay = el('div', { class: 'modal-overlay' })
  const grip = el('button', { class: 'modal-grip', 'aria-label': t('table.sheetClose') })
  const box = el('div', { class: 'modal' }, [
    grip,
    title ? el('h2', { class: 'modal-title' }, title) : null,
    el('div', { class: 'modal-content' }, content),
    el('div', { class: 'modal-actions' }, actions)
  ])
  overlay.append(box)
  overlay.addEventListener('click', e => { if (e.target === overlay) close() })

  dragToDismiss(box, box, { onDismiss: () => close() })

  document.body.append(overlay)
  function close() { overlay.remove() }
  return { overlay, close }
}

export function toast(message) {
  const t = el('div', { class: 'toast' }, message)
  document.body.append(t)
  requestAnimationFrame(() => t.classList.add('show'))
  setTimeout(() => {
    t.classList.remove('show')
    setTimeout(() => t.remove(), 250)
  }, 2200)
}

// Route transition into a game — same choreography for every game:
//  1) a disc bursts from the tapped point and covers the screen,
//  2) the route swaps underneath,
//  3) the cover lifts away like a curved curtain, revealing the game while its
//     sections rise in (the stagger lives in CSS on .game-root).
// Falls back to an instant navigate when reduced motion is requested.
export function transitionTo(x, y, navigate) {
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduce || typeof document === 'undefined') { navigate(); return }

  const vw = window.innerWidth
  const vh = window.innerHeight
  const R = Math.hypot(Math.max(x, vw - x), Math.max(y, vh - y)) + 4

  const ov = document.createElement('div')
  ov.className = 'route-iris'
  ov.style.clipPath = `circle(0px at ${x}px ${y}px)`
  ov.style.webkitClipPath = `circle(0px at ${x}px ${y}px)`
  document.body.appendChild(ov)
  ov.getBoundingClientRect() // force reflow so the transition runs

  // Phase 1: cover from the tapped point.
  ov.style.transition = 'clip-path .3s cubic-bezier(.66,0,.34,1), -webkit-clip-path .3s cubic-bezier(.66,0,.34,1)'
  ov.style.clipPath = `circle(${R}px at ${x}px ${y}px)`
  ov.style.webkitClipPath = `circle(${R}px at ${x}px ${y}px)`

  let swapped = false
  function swap() {
    if (swapped) return
    swapped = true
    navigate() // game mounts behind the cover (its stagger starts now)

    // Phase 2: lift the curtain up with a curved bottom edge.
    requestAnimationFrame(() => {
      ov.classList.add('lifting') // rounds the bottom edge
      ov.style.clipPath = 'none'
      ov.style.webkitClipPath = 'none'
      ov.getBoundingClientRect()
      ov.style.transition = 'transform .5s cubic-bezier(.6,0,.12,1)'
      ov.style.transform = 'translateY(-102%)'
      const done = () => ov.remove()
      ov.addEventListener('transitionend', done, { once: true })
      setTimeout(done, 700)
    })
  }
  ov.addEventListener('transitionend', swap, { once: true })
  setTimeout(swap, 360) // fallback if transitionend doesn't fire
}

export function shuffle(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
