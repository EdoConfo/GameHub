// Small DOM helpers. No framework — just enough to keep screens readable.

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
  // menu voices
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  words: '<path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.6-2.4 2.2-2.4 3.6"/><path d="M12 17h.01"/>',
  stats: '<path d="M5 20V11M12 20V5M19 20v-7"/>',
  // settings / players
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  offline: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  // Goddess of Justice: a balance
  scales: '<path d="M12 3.5V20M8 20h8M4 7h16"/><path d="M4 7l-2.5 6a2.5 2.5 0 0 0 5 0z"/><path d="M20 7l-2.5 6a2.5 2.5 0 0 0 5 0z"/>',
  players: '<path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20"/><circle cx="10" cy="8" r="3.5"/><path d="M20 20v-1.5a3.5 3.5 0 0 0-2.6-3.38"/><path d="M15 4.62a3.5 3.5 0 0 1 0 6.76"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13a1.65 1.65 0 0 0 .33 1.82l.05.05a2 2 0 1 1-2.83 2.83l-.05-.05a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.1a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.05.05a2 2 0 1 1-2.83-2.83l.05-.05a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.1a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.05-.05a2 2 0 1 1 2.83-2.83l.05.05a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.1a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.05-.05a2 2 0 1 1 2.83 2.83l-.05.05a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.1a1.65 1.65 0 0 0-1.5 1z"/>'
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
      onBack ? el('button', { class: 'icon-btn', 'aria-label': 'Indietro', onclick: onBack }, '‹') : el('span', { class: 'icon-btn ghost' }),
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

// Simple modal. Returns a controller with close().
export function modal({ title, content, actions = [] } = {}) {
  const overlay = el('div', { class: 'modal-overlay' })
  const box = el('div', { class: 'modal' }, [
    title ? el('h2', { class: 'modal-title' }, title) : null,
    el('div', { class: 'modal-content' }, content),
    el('div', { class: 'modal-actions' }, actions)
  ])
  overlay.append(box)
  overlay.addEventListener('click', e => { if (e.target === overlay) close() })
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
