// The one screen a Quiplash match is not played at the table: writing.
//
// It takes the whole screen on purpose. The phone is in one person's hands,
// the prompt is theirs alone, and what they type must not be readable by the
// person sitting next to them — a drawer with the table above it is exactly
// the wrong shape for that.
import { el, button } from '../../shared/ui.js'
import { t } from '../../shared/i18n.js'
import { jobsFor } from './round.js'
import * as match from './match.js'

const MAX = 90 // long enough for a joke, short enough to read out loud

// The keyboard takes half the screen and the page can't scroll (it's an app,
// not a document). So the screen becomes what the keyboard leaves of it, and
// the prompt, the field and the button stay together above it.
function keepAbove(node) {
  const vv = window.visualViewport
  if (!vv) return () => {}
  const place = () => {
    node.style.height = vv.height + 'px'
    node.style.transform = vv.offsetTop ? `translateY(${vv.offsetTop}px)` : ''
  }
  place()
  vv.addEventListener('resize', place)
  vv.addEventListener('scroll', place)
  return () => {
    vv.removeEventListener('resize', place)
    vv.removeEventListener('scroll', place)
  }
}

export function renderWrite(api) {
  const { state, runtime } = api
  const me = state.players[state.writeIndex]
  const jobs = jobsFor(state.duels, state.writeIndex)

  const kicker = el('p', { class: 'drawer-kicker' })
  const promptEl = el('div', { class: 'write-prompt' })
  const field = el('textarea', {
    class: 'text-area write-field', rows: 2, maxlength: String(MAX),
    placeholder: t('ql.write.placeholder'), autocomplete: 'off',
    autocapitalize: 'sentences', spellcheck: 'false'
  })
  const left = el('span', { class: 'write-left' })
  const go = button(t('common.forward'), { variant: 'primary', full: true, onClick: () => next() })

  const wrap = el('div', { class: 'fullscreen write-area' }, [
    el('div', { class: 'write-head' }, [kicker, promptEl]),
    el('div', { class: 'write-box' }, [field, left]),
    go
  ])

  function paint() {
    const job = jobs[state.writeStep]
    kicker.textContent = jobs.length > 1
      ? t('ql.write.step', { name: me.name, n: state.writeStep + 1, of: jobs.length })
      : me.name
    promptEl.textContent = state.duels[job.duel].prompt
    field.value = state.duels[job.duel].answers[job.slot].text || ''
    go.textContent = state.writeStep + 1 < jobs.length ? t('ql.write.next') : t('ql.write.done')
    room()
    // Focus while the tap that brought us here is still the current gesture:
    // that's the only way iOS opens the keyboard without a second tap. The
    // first paint happens before the screen is on the page, so that one is
    // asked for by whoever puts it there (`ready`), still inside the same tap.
    if (wrap.isConnected) field.focus()
  }

  function room() {
    const n = field.value.trim().length
    left.textContent = t('ql.write.left', { n: MAX - field.value.length })
    go.disabled = !n
  }

  function next() {
    const job = jobs[state.writeStep]
    const text = field.value.trim().slice(0, MAX)
    if (!text) return
    state.duels[job.duel].answers[job.slot].text = text
    if (state.writeStep + 1 < jobs.length) { state.writeStep++; paint(); return }
    field.blur()
    match.written(api)
  }

  field.addEventListener('input', room)
  // Enter is "done with this one", not a newline: an answer is one line.
  field.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); next() } })

  runtime.viewport = keepAbove(wrap)
  paint()
  wrap.ready = () => field.focus()
  return wrap
}
