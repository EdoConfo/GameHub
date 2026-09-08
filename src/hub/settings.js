import { el, screen, button, clear, modal, toast } from '../shared/ui.js'

export function renderSettings(root, ctx) {
  const view = screen({ title: 'Impostazioni', onBack: () => ctx.router.go('/') })
  view.body.append(themeSection(ctx))
  view.body.append(playersSection(ctx))
  view.body.append(packsSection(ctx))
  root.append(view)
}

// ---- Theme ----
function themeSection(ctx) {
  const current = ctx.storage.get('theme', 'dark')
  const section = el('section', { class: 'card-section' }, [
    el('h2', { class: 'section-title' }, 'Aspetto')
  ])
  const row = el('div', { class: 'row space-between' }, [
    el('span', {}, 'Tema scuro'),
    toggle(current !== 'light', on => ctx.applyTheme(on ? 'dark' : 'light'))
  ])
  section.append(row)
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
  const addBtn = button('Aggiungi', { variant: 'secondary', onClick: submit })

  section.append(list)
  section.append(el('div', { class: 'row' }, [input, addBtn]))
  refresh()
  return section
}

// ---- Word packs ----
function packsSection(ctx) {
  const section = el('section', { class: 'card-section' }, [
    el('h2', { class: 'section-title' }, 'Pacchetti di parole'),
    el('p', { class: 'muted' }, 'Usati dai giochi di parole (es. Mister White). Attiva quelli che vuoi in gioco.')
  ])
  const list = el('div', { class: 'pack-list' })

  function refresh() {
    clear(list)
    const enabled = new Set(ctx.packs.enabledIds())
    for (const pack of ctx.packs.allPacks()) {
      const isOn = enabled.has(pack.id)
      const row = el('div', { class: 'pack-row' }, [
        el('label', { class: 'pack-main' }, [
          el('input', {
            type: 'checkbox',
            checked: isOn,
            onchange: () => { ctx.packs.toggleEnabled(pack.id); refresh() }
          }),
          el('span', { class: 'pack-name' }, pack.name),
          el('span', { class: 'pack-count' }, `${pack.pairs.length} coppie${pack.custom ? ' · tuo' : ''}`)
        ]),
        pack.custom
          ? el('button', { class: 'chip-x', 'aria-label': 'Elimina', onclick: () => { ctx.packs.deleteCustomPack(pack.id); refresh() } }, '×')
          : null
      ])
      list.append(row)
    }
  }

  section.append(list)
  section.append(button('+ Aggiungi pacchetto', { variant: 'secondary', onClick: () => openAddPack(ctx, refresh) }))
  refresh()
  return section
}

function openAddPack(ctx, onAdded) {
  const nameInput = el('input', { class: 'text-input', type: 'text', placeholder: 'Nome pacchetto', maxlength: '40' })
  const textArea = el('textarea', {
    class: 'text-area',
    rows: '8',
    placeholder: 'Un accoppiamento per riga:\ncane,lupo\npizza,focaccia\n\n…oppure incolla JSON con { "pairs": [...] }'
  })
  const errBox = el('p', { class: 'error-text' })

  const m = modal({
    title: 'Nuovo pacchetto',
    content: [nameInput, textArea, errBox],
    actions: [
      button('Annulla', { variant: 'ghost', onClick: () => m.close() }),
      button('Salva', {
        variant: 'primary',
        onClick: () => {
          try {
            const pack = ctx.packs.addCustomPack(nameInput.value, textArea.value)
            m.close()
            toast(`Aggiunto “${pack.name}” (${pack.pairs.length} coppie)`)
            onAdded()
          } catch (err) {
            errBox.textContent = err.message
          }
        }
      })
    ]
  })
  nameInput.focus()
}
