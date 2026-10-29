// Writing, wherever it happens.
//
// One phone or five, writing is the same page: a prompt, a field, a button —
// and nothing else, because the prompt belongs to one person for that minute
// and what they type must not be readable over their shoulder. It rises as a
// sheet over the table's drawer, covering it whole, and the table stays above
// it: the scene is still there, only the drawer is somebody's for a minute.
// The keyboard is the hub's business — the whole scene becomes what it leaves.
import { el, button } from '../../shared/ui.js'
import { t } from '../../shared/i18n.js'

const MAX = 90 // long enough for a joke, short enough to read out loud

// The writing screen.
//   title:  who is writing (the name, when the phone is being passed around)
//   jobs:   [{ prompt, text }] — one or more, walked in order
//   onSave(i, text):  keep answer i. Return false and the screen stays put.
//   onDone():         the last one is in
//   -> the node, to open with stage.openSheet(); node.ready() to be called once
//      it is on the page, node.stop() when it leaves
export function writeScreen({ title = '', jobs = [], onSave = () => true, onDone = () => {} } = {}) {
  let step = 0

  const kicker = el('p', { class: 'drawer-kicker' })
  const promptEl = el('div', { class: 'write-prompt' })
  const field = el('textarea', {
    class: 'text-area write-field', rows: 2, maxlength: String(MAX),
    placeholder: t('ql.write.placeholder'), autocomplete: 'off',
    autocapitalize: 'sentences', spellcheck: 'false'
  })
  const left = el('span', { class: 'write-left' })
  const go = button(t('ql.write.next'), { variant: 'primary', full: true, onClick: () => next() })

  const wrap = el('div', { class: 'drawer-page write-area' }, [
    // The prompt and the field travel together in the middle of whatever the
    // keyboard leaves of the screen; the button stays under them, which with
    // the keyboard up means right on top of it.
    el('div', { class: 'write-main' }, [
      el('div', { class: 'write-head' }, [kicker, promptEl]),
      el('div', { class: 'write-box' }, [field, left])
    ]),
    go
  ])

  function paint() {
    const job = jobs[step]
    if (!job) return
    kicker.textContent = jobs.length > 1
      ? (title ? t('ql.write.step', { name: title, n: step + 1, of: jobs.length }) : t('ql.write.stepPlain', { n: step + 1, of: jobs.length }))
      : title
    promptEl.textContent = job.prompt
    field.value = job.text || ''
    go.textContent = step + 1 < jobs.length ? t('ql.write.next') : t('ql.write.done')
    room()
    // Focus while the tap that brought us here is still the current gesture:
    // that is the only way iOS opens the keyboard without a second tap. The
    // first paint happens before the screen is on the page, so that one is
    // asked for by whoever puts it there (`ready`), still inside the same tap.
    if (wrap.isConnected) field.focus()
  }

  function room() {
    left.textContent = t('ql.write.left', { n: MAX - field.value.length })
    go.disabled = !field.value.trim()
  }

  function next() {
    const text = field.value.trim().slice(0, MAX)
    if (!text) return
    if (onSave(step, text) === false) return
    jobs[step].text = text
    if (step + 1 < jobs.length) { step++; paint(); return }
    field.blur()
    onDone()
  }

  field.addEventListener('input', room)
  // Enter is "done with this one", not a newline: an answer is one line.
  field.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); next() } })

  paint()
  wrap.ready = () => field.focus()
  wrap.stop = () => field.blur()
  return wrap
}
