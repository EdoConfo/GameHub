// Reusable pack-management screen, rendered INSIDE a game (not global settings).
// Each game passes its own store; word packs are managed per game. Tap a pack
// to rename it or rewrite its words; built-in packs can be edited too and put
// back as they came.
//   selectable: on/off boxes to choose which packs to play with (Heads Up).
//   Mister White chooses them at the table instead, so it passes false.
import { el, screen, button, modal, toast, clear } from './ui.js'
import { t } from './i18n.js'

export function renderPackManager(store, { title = '', help = '', onBack, selectable = true } = {}) {
  const view = screen({ title: title || t('packs.title'), onBack })
  const list = el('div', { class: 'pack-list' })

  function refresh() {
    clear(list)
    const enabled = new Set(store.enabledIds())
    for (const pack of store.allPacks()) {
      const tag = pack.custom ? t('packs.tagCustom') : pack.modified ? t('packs.tagModified') : ''
      list.append(el('div', { class: 'pack-row' }, [
        selectable ? el('input', {
          type: 'checkbox', class: 'pack-check', checked: enabled.has(pack.id), 'aria-label': t('packs.use', { name: pack.name }),
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
    el('h2', { class: 'section-title' }, t('packs.section')),
    help ? el('p', { class: 'muted' }, help) : null,
    list
  ])
  view.body.append(sec)
  view.body.append(button(t('packs.new'), { variant: 'secondary', full: true, onClick: () => openEditor(null) }))

  // A new pack (no `pack`) or an existing one: its name and one item per line.
  function openEditor(pack) {
    const nameInput = el('input', { class: 'text-input', type: 'text', placeholder: t('packs.namePlaceholder'), maxlength: '40', value: pack ? pack.name : '' })
    const textArea = el('textarea', { class: 'text-area', rows: '10', placeholder: store.placeholder })
    textArea.value = pack ? store.toText(pack) : ''
    const errBox = el('p', { class: 'error-text' })

    const extra = []
    if (pack && pack.custom) {
      // two taps to delete: the first one asks
      const del = button(t('common.delete'), {
        variant: 'ghost', onClick: () => {
          if (!del.dataset.sure) { del.dataset.sure = '1'; del.textContent = t('packs.deleteSure'); return }
          store.deleteCustomPack(pack.id)
          m.close()
          toast(t('packs.deleted', { name: pack.name }))
          refresh()
        }
      })
      extra.push(del)
    }
    if (pack && pack.modified) {
      extra.push(button(t('common.restore'), {
        variant: 'ghost', onClick: () => {
          store.resetPack(pack.id)
          m.close()
          toast(t('packs.restored'))
          refresh()
        }
      }))
    }

    const m = modal({
      title: pack ? t('packs.editTitle') : t('packs.newTitle'),
      content: [nameInput, textArea, errBox],
      actions: [
        ...extra,
        button(t('common.cancel'), { variant: 'ghost', onClick: () => m.close() }),
        button(t('common.save'), {
          variant: 'primary', onClick: () => {
            try {
              const saved = pack
                ? store.updatePack(pack.id, { name: nameInput.value, text: textArea.value })
                : store.addCustomPack(nameInput.value, textArea.value, { enable: selectable })
              m.close()
              toast(t(pack ? 'packs.saved' : 'packs.added', { name: saved.name, n: saved.items.length, unit: store.unit }))
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
