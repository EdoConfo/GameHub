// Reusable pack-management screen, rendered INSIDE a game (not global settings).
// Each game passes its own store; word packs are managed per game. Tap a pack
// to rename it or rewrite its words; built-in packs can be edited too and put
// back as they came.
//   selectable: on/off boxes to choose which packs to play with (Heads Up).
//   Mister White chooses them at the table instead, so it passes false.
import { el, screen, button, modal, toast, clear } from './ui.js'

export function renderPackManager(store, { title = 'Parole', help = '', onBack, selectable = true } = {}) {
  const view = screen({ title, onBack })
  const list = el('div', { class: 'pack-list' })

  function refresh() {
    clear(list)
    const enabled = new Set(store.enabledIds())
    for (const pack of store.allPacks()) {
      const tag = pack.custom ? ' · tuo' : pack.modified ? ' · modificato' : ''
      list.append(el('div', { class: 'pack-row' }, [
        selectable ? el('input', {
          type: 'checkbox', class: 'pack-check', checked: enabled.has(pack.id), 'aria-label': 'Usa ' + pack.name,
          onchange: () => { store.toggleEnabled(pack.id); refresh() }
        }) : null,
        el('button', { class: 'pack-open', onclick: () => openEditor(pack) }, [
          el('span', { class: 'pack-text' }, [
            el('span', { class: 'pack-name' }, pack.name),
            el('span', { class: 'pack-count' }, `${pack.items.length} ${store.unit}${tag}`)
          ]),
          el('span', { class: 'pack-arrow', 'aria-hidden': 'true' }, '›')
        ])
      ]))
    }
  }

  const sec = el('section', { class: 'card-section' }, [
    el('h2', { class: 'section-title' }, 'Pacchetti'),
    help ? el('p', { class: 'muted' }, help) : null,
    list
  ])
  view.body.append(sec)
  view.body.append(button('+ Nuovo pacchetto', { variant: 'secondary', full: true, onClick: () => openEditor(null) }))

  // A new pack (no `pack`) or an existing one: its name and one item per line.
  function openEditor(pack) {
    const nameInput = el('input', { class: 'text-input', type: 'text', placeholder: 'Nome pacchetto', maxlength: '40', value: pack ? pack.name : '' })
    const textArea = el('textarea', { class: 'text-area', rows: '10', placeholder: store.placeholder })
    textArea.value = pack ? store.toText(pack) : ''
    const errBox = el('p', { class: 'error-text' })

    const extra = []
    if (pack && pack.custom) {
      // two taps to delete: the first one asks
      const del = button('Elimina', {
        variant: 'ghost', onClick: () => {
          if (!del.dataset.sure) { del.dataset.sure = '1'; del.textContent = 'Elimina davvero'; return }
          store.deleteCustomPack(pack.id)
          m.close()
          toast(`Eliminato “${pack.name}”`)
          refresh()
        }
      })
      extra.push(del)
    }
    if (pack && pack.modified) {
      extra.push(button('Ripristina', {
        variant: 'ghost', onClick: () => {
          store.resetPack(pack.id)
          m.close()
          toast('Ripristinato com’era')
          refresh()
        }
      }))
    }

    const m = modal({
      title: pack ? 'Modifica pacchetto' : 'Nuovo pacchetto',
      content: [nameInput, textArea, errBox],
      actions: [
        ...extra,
        button('Annulla', { variant: 'ghost', onClick: () => m.close() }),
        button('Salva', {
          variant: 'primary', onClick: () => {
            try {
              const saved = pack
                ? store.updatePack(pack.id, { name: nameInput.value, text: textArea.value })
                : store.addCustomPack(nameInput.value, textArea.value, { enable: selectable })
              m.close()
              toast(`${pack ? 'Salvato' : 'Aggiunto'} “${saved.name}” (${saved.items.length} ${store.unit})`)
              refresh()
            } catch (err) { errBox.textContent = err.message }
          }
        })
      ]
    })
    if (!pack) nameInput.focus()
  }

  refresh()
  return view
}
