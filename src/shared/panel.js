import { el } from './ui.js'

// A panel: the drawer's big sibling, for a game that has no table to keep on
// screen. It rises from below and stands still from under the header to the
// bottom edge — no grabber, nothing to fold, the whole room is the game's.
// Pages change inside it the way they do in the drawer: the old one lifts and
// fades over the new one rising in (docs/SCENE.md).
//   top(): px from the host's top where the panel starts (under the header)
export function createPanel(host, { top } = {}) {
  const body = el('div', { class: 'panel-body' })
  const node = el('div', { class: 'panel' }, [body])
  host.append(node)
  let pageKey = null
  let isOpen = false

  const place = () => { node.style.top = (top ? top() : 0) + 'px' }

  // Show `page` in the panel. `key` names it: the same key again is the same
  // page brought up to date (a shot landed), swapped where it stands.
  function present(page, { key = null } = {}) {
    const same = key != null && key === pageKey
    pageKey = key
    const old = body.firstElementChild
    const animate = isOpen && !same && old && old !== page
    let ghost = null
    if (animate) {
      ghost = el('div', {
        class: 'panel-ghost',
        style: `top:${old.offsetTop}px;left:${old.offsetLeft}px;width:${old.offsetWidth}px;height:${old.offsetHeight}px`
      })
    }
    body.replaceChildren(page)
    if (!animate) return
    ghost.append(old)
    node.append(ghost)
    ghost.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-10px)' }],
      { duration: 220, easing: 'ease-in' }).onfinish = () => ghost.remove()
    page.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
      { duration: 260, easing: 'ease-out' })
  }

  // Up from the bottom edge — or already there, arriving on its own address.
  function open({ slide = true } = {}) {
    place()
    isOpen = true
    if (!slide) node.classList.add('instant')
    void node.offsetHeight
    node.classList.add('open')
    if (!slide) requestAnimationFrame(() => node.classList.remove('instant'))
  }

  // Back down the way it came; then it's gone.
  function close(done) {
    isOpen = false
    node.classList.remove('open')
    let finished = false
    const end = () => { if (finished) return; finished = true; node.remove(); if (done) done() }
    node.addEventListener('transitionend', e => { if (e.target === node) end() })
    setTimeout(end, 700) // a transition that never ran (reduced motion) still ends
  }

  return { node, present, open, close, refit: place, destroy: () => node.remove() }
}
