// The pieces every game played across phones draws the same way: the field
// the room code is typed into, and the screen that steps out of the
// keyboard's way. Quiplash had them first; Battaglia navale uses them too.
import { el } from './ui.js'
import { cleanCode, CODE_LEN } from './realtime.js'

// The keyboard takes half the screen and the page cannot scroll (it is an app,
// not a document). So the screen becomes what the keyboard leaves of it, and
// whatever is on it stays together above it.
export function keepAbove(node) {
  const vv = window.visualViewport
  if (!vv) return () => {}
  // Only while the keyboard is actually up: otherwise the node keeps its own
  // height (the whole screen, see .canvas), which the visual viewport can
  // measure a strip short of, from the Home screen on iOS.
  const place = () => {
    const keyboard = vv.height < window.innerHeight - 80
    node.style.height = keyboard ? vv.height + 'px' : ''
    node.style.transform = keyboard && vv.offsetTop ? `translateY(${vv.offsetTop}px)` : ''
  }
  place()
  vv.addEventListener('resize', place)
  vv.addEventListener('scroll', place)
  return () => {
    vv.removeEventListener('resize', place)
    vv.removeEventListener('scroll', place)
  }
}

// ---------- the code: four boxes that are one field ----------
// Four boxes, because a four-letter code read out loud across a table is
// four letters, and a single long field says nothing about how many are
// missing. One input, though, and not four: with one per box every letter
// costs a focus jump, and a phone keyboard that closes and reopens between
// one and the next. So the boxes are only the drawing — underneath there is
// one field, transparent, and you type the code straight through it (or
// paste it, which four inputs would not take either).
//   initial:   the code already there (the last one typed on this phone)
//   onChange(clean)
//   label:     what a screen reader calls the field
export function codeField(initial, onChange, label) {
  const boxes = el('div', { class: 'code-boxes' })
  const input = el('input', {
    class: 'code-entry', type: 'text', value: initial || '',
    inputmode: 'text', autocapitalize: 'characters', autocomplete: 'off',
    autocorrect: 'off', spellcheck: 'false', maxlength: String(CODE_LEN),
    'aria-label': label
  })

  function paint() {
    const chars = input.value.split('')
    const here = Math.min(chars.length, CODE_LEN - 1)
    const live = document.activeElement === input
    boxes.replaceChildren(...Array.from({ length: CODE_LEN }, (_, i) => el('span', {
      class: 'code-box' + (live && i === here ? ' on' : '')
    }, chars[i] || '')))
  }

  input.addEventListener('input', () => {
    const clean = cleanCode(input.value)
    if (input.value !== clean) input.value = clean
    paint()
    onChange(clean)
  })
  input.addEventListener('focus', paint)
  input.addEventListener('blur', paint)

  paint()
  // The padding around the boxes belongs to the field too: a tap anywhere on
  // it lands the caret after the last letter, never in the middle of one.
  return el('div', {
    class: 'code-field',
    onclick: () => {
      input.focus()
      const n = input.value.length
      try { input.setSelectionRange(n, n) } catch { /* not a field with a caret */ }
    }
  }, [boxes, input])
}
