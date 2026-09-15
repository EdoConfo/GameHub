// The editor for one word pack: its icon, its name, and its words in a table —
// one row per item, one column per thing the game needs (the civilians' word
// and the Undercovers' one for Mister White; a single word for Heads Up).
//
// A table and not a free text box on purpose: a pack written by hand in a
// textarea is a pack with a missing comma in it, and you find out at the table
// with six people waiting. Here a row is either whole or it says it isn't.
import { el, button, modal, toast, walls } from './ui.js'
import { t } from './i18n.js'

// Emoji for a pack's icon, in the app's own key: things you'd name a pack
// after, not a full keyboard to get lost in.
const PACK_EMOJIS = [
  '💬', '🎲', '🐾', '🍕', '🎬', '⚽', '🎭', '⭐', '🎵', '🌍',
  '🧠', '💼', '🏠', '🚗', '✈️', '🏖️', '🎄', '🎃', '❤️', '🔥',
  '🌙', '☀️', '🍀', '🎓', '🔬', '🎨', '📚', '👻', '🦄', '🤖'
]

export function openPackEditor(store, pack, { onDone } = {}) {
  const columns = store.columns
  let emoji = (pack && pack.emoji) || '💬'
  const rows = pack ? store.toRows(pack) : [store.blankRow(), store.blankRow(), store.blankRow()]

  const iconBtn = el('button', { class: 'pack-icon', 'aria-label': t('packs.icon'), onclick: () => pickEmoji() }, emoji)
  const nameInput = el('input', {
    class: 'text-input', type: 'text', placeholder: t('packs.namePlaceholder'),
    maxlength: '40', value: pack ? pack.name : ''
  })
  const errBox = el('p', { class: 'error-text' })
  const table = el('div', { class: 'pack-table list-scroll' })
  const count = el('p', { class: 'muted small center' })

  function pickEmoji() {
    const grid = el('div', { class: 'emoji-grid' })
    const sheet = modal({
      title: t('packs.icon'),
      content: [grid],
      actions: [button(t('common.cancel'), { variant: 'ghost', onClick: () => sheet.close() })]
    })
    for (const e of PACK_EMOJIS) {
      grid.append(el('button', {
        class: 'emoji-cell' + (e === emoji ? ' on' : ''),
        onclick: () => { emoji = e; iconBtn.textContent = e; sheet.close() }
      }, e))
    }
  }

  // One row of cells plus the way to take it away.
  function rowNode(row) {
    const node = el('div', { class: 'pack-row' })
    for (const col of columns) {
      const cell = el('input', {
        class: 'text-input cell', type: 'text', value: row[col.key] || '',
        placeholder: col.label, 'aria-label': col.label,
        oninput: e => { row[col.key] = e.target.value; mark(); tally() }
      })
      node.append(cell)
    }
    node.append(el('button', {
      class: 'round-btn sm', 'aria-label': t('packs.dropRow'),
      onclick: () => {
        const i = rows.indexOf(row)
        if (i >= 0) rows.splice(i, 1)
        if (!rows.length) rows.push(store.blankRow())
        paint()
      }
    }, '−'))
    return node
  }

  function paint() {
    table.replaceChildren(
      el('div', { class: 'pack-row head' }, [
        ...columns.map(c => el('span', { class: 'cell-label' }, c.label)),
        el('span', { class: 'cell-label' })
      ]),
      ...rows.map(rowNode)
    )
    walls(table)
    mark()
    tally()
  }

  // A row that was started and left open is the only real mistake here.
  function mark() {
    const nodes = [...table.querySelectorAll('.pack-row')].slice(1)
    nodes.forEach((node, i) => {
      const row = rows[i]
      if (!row) return
      const cells = columns.map(c => String(row[c.key] || '').trim())
      node.classList.toggle('half', cells.some(v => v) && cells.some(v => !v))
    })
  }

  function tally() {
    const { items, blanks } = store.fromRows(rows)
    count.textContent = blanks
      ? t(blanks === 1 ? 'packs.halfRow' : 'packs.halfRows', { n: blanks })
      : t('packs.rowCount', { n: items.length, unit: store.unit })
    count.classList.toggle('warn', blanks > 0)
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

  const head = el('div', { class: 'pack-head' }, [iconBtn, nameInput])

  // Games that draw from several packs at once (Heads Up) switch them on here;
  // Mister White picks its packs at the table, right before a match.
  const switches = []
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
    switches.push(el('div', { class: 'row space-between' }, [el('span', {}, t('packs.inPlay')), sw]))
  }

  const m = modal({
    title: pack ? '' : t('packs.newTitle'),
    content: [
      head,
      ...switches,
      table,
      el('div', { class: 'pack-foot' }, [
        button(t('packs.addRow'), { variant: 'secondary', onClick: () => { rows.push(store.blankRow()); paint(); table.scrollTop = table.scrollHeight } }),
        count
      ]),
      errBox
    ],
    actions: [
      ...extra,
      button(t('common.cancel'), { variant: 'ghost', onClick: () => m.close() }),
      button(t('common.save'), {
        variant: 'primary', onClick: () => {
          const { items, blanks } = store.fromRows(rows)
          if (blanks) {
            errBox.textContent = t(blanks === 1 ? 'packs.halfRowStop' : 'packs.halfRowsStop', { n: blanks })
            return
          }
          try {
            const saved = pack
              ? store.updatePack(pack.id, { name: nameInput.value, items, emoji })
              : store.addCustomPack(nameInput.value, items, { enable: !!store.selectable, emoji })
            m.close()
            toast(t(pack ? 'packs.saved' : 'packs.added', { name: saved.name, n: saved.items.length, unit: store.unit }))
            if (onDone) onDone()
          } catch (err) { errBox.textContent = err.message }
        }
      })
    ]
  })
  m.overlay.classList.add('pack-editor')
  paint()
  if (!pack) nameInput.focus()
  return m
}
