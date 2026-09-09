import { el, screen, button, clear } from '../shared/ui.js'

// Global settings = things common to the whole app: theme and the player
// roster. Word packs are NOT here — each game manages its own packs from
// inside the game.
export function renderSettings(root, ctx) {
  const view = screen({ title: 'Impostazioni', onBack: () => ctx.router.go('/') })
  view.body.append(themeSection(ctx))
  view.body.append(playersSection(ctx))
  view.body.append(el('p', { class: 'muted small center' },
    'Le parole e i pacchetti si gestiscono dentro ogni gioco.'))
  root.append(view)
}

// ---- Theme ----
function themeSection(ctx) {
  const current = ctx.storage.get('theme', 'dark')
  const section = el('section', { class: 'card-section' }, [
    el('h2', { class: 'section-title' }, 'Aspetto')
  ])
  section.append(el('div', { class: 'row space-between' }, [
    el('span', {}, 'Tema scuro'),
    toggle(current !== 'light', on => ctx.applyTheme(on ? 'dark' : 'light'))
  ]))
  return section
}

function toggle(on, onChange) {
  const knob = el('span', { class: 'switch-knob' })
  const sw = el('button', {
    class: 'switch' + (on ? ' on' : ''),
    role: 'switch',
    'aria-checked': String(on),
    onclick: () => {
      on = !on
      sw.classList.toggle('on', on)
      sw.setAttribute('aria-checked', String(on))
      onChange(on)
    }
  }, knob)
  return sw
}

// ---- Players ----
function playersSection(ctx) {
  const section = el('section', { class: 'card-section' }, [
    el('h2', { class: 'section-title' }, 'Giocatori')
  ])
  const list = el('div', { class: 'chip-list' })
  const input = el('input', { class: 'text-input', type: 'text', placeholder: 'Aggiungi giocatore…', maxlength: '24' })

  function refresh() {
    clear(list)
    const names = ctx.players.all()
    if (!names.length) {
      list.append(el('p', { class: 'muted' }, 'Nessun giocatore salvato. I nomi restano tra una partita e l’altra.'))
    }
    names.forEach((name, i) => {
      list.append(el('span', { class: 'chip' }, [
        name,
        el('button', { class: 'chip-x', 'aria-label': 'Rimuovi', onclick: () => { ctx.players.removeAt(i); refresh() } }, '×')
      ]))
    })
  }

  function submit() {
    const v = input.value.trim()
    if (!v) return
    ctx.players.add(v)
    input.value = ''
    refresh()
    input.focus()
  }

  input.addEventListener('keydown', e => { if (e.key === 'Enter') submit() })

  section.append(list)
  section.append(el('div', { class: 'row' }, [input, button('Aggiungi', { variant: 'secondary', onClick: submit })]))
  refresh()
  return section
}
