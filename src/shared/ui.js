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

// Iris route transition: a bg-colored disc bursts from (x,y), covers the
// screen, we swap the route underneath, then it fades away revealing the new
// screen. Falls back to an instant navigate when reduced motion is requested.
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

  ov.style.transition = 'clip-path .42s cubic-bezier(.4, 0, .2, 1), -webkit-clip-path .42s cubic-bezier(.4, 0, .2, 1)'
  ov.style.clipPath = `circle(${R}px at ${x}px ${y}px)`
  ov.style.webkitClipPath = `circle(${R}px at ${x}px ${y}px)`

  let swapped = false
  function swap() {
    if (swapped) return
    swapped = true
    navigate()
    requestAnimationFrame(() => {
      ov.style.transition = 'opacity .3s ease'
      ov.style.opacity = '0'
      setTimeout(() => ov.remove(), 340)
    })
  }
  ov.addEventListener('transitionend', swap, { once: true })
  setTimeout(swap, 500) // fallback if transitionend doesn't fire
}

export function shuffle(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
