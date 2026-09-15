// The editor for one word pack: its name, its words one per line, and what you
// can do to it. A panel, like every other question in the app.
//
// Packs live on the right arc of a game's circle now, so this is all that's
// left of the old management screen: the list is the arc itself.
import { el, button, modal, toast } from './ui.js'
import { t } from './i18n.js'

// pack: the one to edit, or null to write a new one.
//   onDone(): the list outside has changed and wants repainting
export function openPackEditor(store, pack, { onDone } = {}) {
  const nameInput = el('input', {
    class: 'text-input', type: 'text', placeholder: t('packs.namePlaceholder'),
    maxlength: '40', value: pack ? pack.name : ''
  })
  const textArea = el('textarea', { class: 'text-area', rows: '10', placeholder: store.placeholder })
  textArea.value = pack ? store.toText(pack) : ''
  const errBox = el('p', { class: 'error-text' })

  const content = [nameInput, textArea, errBox]

  // Games that draw from several packs at once (Heads Up) switch them on here;
  // Mister White picks its packs at the table, right before a match.
  if (store.selectable && pack) {
    const on = new Set(store.enabledIds()).has(pack.id)
    const sw = el('button', {
      class: 'switch' + (on ? ' on' : ''), role: 'switch', 'aria-checked': String(on),
      onclick: () => {
        const now = store.toggleEnabled(pack.id).includes(pack.id)
        sw.classList.toggle('on', now)
        sw.setAttribute('aria-checked', String(now))
        if (onDone) onDone()
      }
    }, el('span', { class: 'switch-knob' }))
    content.unshift(el('div', { class: 'row space-between' }, [el('span', {}, t('packs.inPlay')), sw]))
  }

  const extra = []
  if (pack && pack.custom) {
    // two taps to delete: the first one asks
    const del = button(t('common.delete'), {
      variant: 'ghost', onClick: () => {
        if (!del.dataset.sure) { del.dataset.sure = '1'; del.textContent = t('packs.deleteSure'); return }
        store.deleteCustomPack(pack.id)
        m.close()
        toast(t('packs.deleted', { name: pack.name }))
        if (onDone) onDone()
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
        if (onDone) onDone()
      }
    }))
  }

  const m = modal({
    title: pack ? pack.name : t('packs.newTitle'),
    content,
    actions: [
      ...extra,
      button(t('common.cancel'), { variant: 'ghost', onClick: () => m.close() }),
      button(t('common.save'), {
        variant: 'primary', onClick: () => {
          try {
            const saved = pack
              ? store.updatePack(pack.id, { name: nameInput.value, text: textArea.value })
              : store.addCustomPack(nameInput.value, textArea.value, { enable: !!store.selectable })
            m.close()
            toast(t(pack ? 'packs.saved' : 'packs.added', { name: saved.name, n: saved.items.length, unit: store.unit }))
            if (onDone) onDone()
          } catch (err) { errBox.textContent = err.message }
        }
      })
    ]
  })
  if (!pack) nameInput.focus()
  return m
}
