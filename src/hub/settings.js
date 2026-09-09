import { el, screen } from '../shared/ui.js'

// Global settings = system-wide only (theme). Players live in the Players
// portal (hub header); word packs live inside each game.
export function renderSettings(root, ctx) {
  const view = screen({ title: 'Impostazioni', onBack: () => ctx.router.go('/') })
  view.body.append(themeSection(ctx))
  view.body.append(el('p', { class: 'muted small center' },
    'I giocatori si gestiscono dall’icona 👥 nella home. Le parole dentro ogni gioco.'))
  root.append(view)
}

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
