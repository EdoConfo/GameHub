// Reusable pack-management screen, rendered INSIDE a game (not global settings).
// Each game passes its own store; word packs are managed per game.
import { el, screen, button, modal, toast, clear } from './ui.js'

export function renderPackManager(store, { title = 'Parole', help = '', onBack } = {}) {
  const view = screen({ title, onBack })
  const list = el('div', { class: 'pack-list' })

  function refresh() {
    clear(list)
    const enabled = new Set(store.enabledIds())
    for (const pack of store.allPacks()) {
      const on = enabled.has(pack.id)
      list.append(el('div', { class: 'pack-row' }, [
        el('label', { class: 'pack-main' }, [
          el('input', { type: 'checkbox', checked: on, onchange: () => { store.toggleEnabled(pack.id); refresh() } }),
          el('span', { class: 'pack-name' }, pack.name),
          el('span', { class: 'pack-count' }, `${pack.items.length} ${store.unit}${pack.custom ? ' · tuo' : ''}`)
        ]),
        pack.custom
          ? el('button', { class: 'chip-x', 'aria-label': 'Elimina', onclick: () => { store.deleteCustomPack(pack.id); refresh() } }, '×')
          : null
      ]))
    }
  }

  const sec = el('section', { class: 'card-section' }, [
    el('h2', { class: 'section-title' }, 'Pacchetti'),
    help ? el('p', { class: 'muted' }, help) : null,
    list
  ])
  view.body.append(sec)
  view.body.append(button('+ Aggiungi pacchetto', { variant: 'secondary', full: true, onClick: openAdd }))

  function openAdd() {
    const nameInput = el('input', { class: 'text-input', type: 'text', placeholder: 'Nome pacchetto', maxlength: '40' })
    const textArea = el('textarea', { class: 'text-area', rows: '8', placeholder: store.placeholder })
    const errBox = el('p', { class: 'error-text' })
    const m = modal({
      title: 'Nuovo pacchetto',
      content: [nameInput, textArea, errBox],
      actions: [
        button('Annulla', { variant: 'ghost', onClick: () => m.close() }),
        button('Salva', {
          variant: 'primary', onClick: () => {
            try {
              const pack = store.addCustomPack(nameInput.value, textArea.value)
              m.close()
              toast(`Aggiunto “${pack.name}” (${pack.items.length} ${store.unit})`)
              refresh()
            } catch (err) { errBox.textContent = err.message }
          }
        })
      ]
    })
    nameInput.focus()
  }

  refresh()
  return view
}
