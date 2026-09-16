// The editor for one word pack: its icon, its name, and its words in a table —
// one row per item, one column per thing the game needs (the civilians' word
// and the Undercovers' one for Mister White; a single word for Heads Up).
//
// A table and not a free text box on purpose: a pack written by hand in a
// textarea is a pack with a missing comma in it, and you find out at the table
// with six people waiting. Here a row is either whole or it says it isn't.
import { el, button, modal, toast, walls, icon } from './ui.js'
import { t } from './i18n.js'

// What a pack can be called by: line icons from the app's own set (ui.js), not
// emoji — the rest of the app is drawn, not typed, and a coloured emoji in a
// row of line icons shouts.
const PACK_ICONS = [
  'words', 'dice', 'paw', 'food', 'film', 'ball', 'mask', 'star',
  'music', 'globe', 'bulb', 'bag', 'home', 'car', 'plane', 'gift',
  'ghost', 'robot', 'book', 'flask', 'palette', 'heart', 'flame', 'leaf'
]

export function openPackEditor(store, pack, { onDone } = {}) {
  const columns = store.columns
  let iconName = (pack && pack.icon) || 'words'
  const rows = pack ? store.toRows(pack) : [store.blankRow(), store.blankRow(), store.blankRow()]

  const iconBtn = el('button', { class: 'pack-icon', 'aria-label': t('packs.icon'), onclick: () => pickIcon() }, icon(iconName))
  const nameInput = el('input', {
    class: 'text-input', type: 'text', placeholder: t('packs.namePlaceholder'),
    maxlength: '40', value: pack ? pack.name : ''
  })
  const errBox = el('p', { class: 'error-text' })
  // The minus asks before it takes: the first tap turns it into a red cross,
  // the second one drops the row, and touching anything else puts it back.
  // Losing a line you just typed to a fat finger is the one mistake here that
  // can't be undone.
  let armed = null
  // The column names sit above the scrolling part, not inside it: they belong
  // to the table, not to the list of rows, and they must never scroll away.
  // The rows fade into the edges as they scroll past them, but never while
  // they're the first or the last one on screen: nobody wants the line they're
  // typing to go dim.
  const heading = el('div', { class: 'pack-row head' }, [
    ...columns.map(c => el('span', { class: 'cell-label' }, c.label)),
    el('span', { class: 'cell-label' })
  ])
  const table = el('div', { class: 'pack-table list-scroll' })
  const count = el('p', { class: 'muted small center' })

  function pickIcon() {
    const grid = el('div', { class: 'icon-grid' })
    const sheet = modal({
      title: t('packs.icon'),
      content: [grid],
      actions: [button(t('common.cancel'), { variant: 'ghost', onClick: () => sheet.close() })]
    })
    for (const name of PACK_ICONS) {
      grid.append(el('button', {
        class: 'icon-cell' + (name === iconName ? ' on' : ''), 'aria-label': name,
        onclick: () => {
          iconName = name
          iconBtn.replaceChildren(icon(name))
          sheet.close()
        }
      }, icon(name)))
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
    const drop = el('button', {
      class: 'round-btn sm row-drop', 'aria-label': t('packs.dropRow'),
      onclick: () => {
        if (armed !== drop) { arm(drop); return }
        disarm()
        const i = rows.indexOf(row)
        if (i >= 0) rows.splice(i, 1)
        if (!rows.length) rows.push(store.blankRow())
        paint()
      }
    }, '−')
    node.append(drop)
    return node
  }

  function arm(btn) {
    disarm()
    armed = btn
    btn.classList.add('sure')
    btn.replaceChildren(icon('close'))
    btn.setAttribute('aria-label', t('packs.dropRowSure'))
  }

  function disarm() {
    if (!armed) return
    armed.classList.remove('sure')
    armed.replaceChildren('−')
    armed.setAttribute('aria-label', t('packs.dropRow'))
    armed = null
  }

  function paint() {
    armed = null
    table.replaceChildren(...rows.map(rowNode))
    walls(table)
    mark()
    tally()
  }

  // A row that was started and left open is the only real mistake here.
  function mark() {
    const nodes = [...table.querySelectorAll('.pack-row')]
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
      heading,
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
              ? store.updatePack(pack.id, { name: nameInput.value, items, icon: iconName })
              : store.addCustomPack(nameInput.value, items, { enable: !!store.selectable, icon: iconName })
            m.close()
            toast(t(pack ? 'packs.saved' : 'packs.added', { name: saved.name, n: saved.items.length, unit: store.unit }))
            if (onDone) onDone()
          } catch (err) { errBox.textContent = err.message }
        }
      })
    ]
  })
  m.overlay.classList.add('pack-editor')
  // a touch anywhere else takes the question back
  m.overlay.addEventListener('pointerdown', e => {
    if (!e.target.closest || !e.target.closest('.row-drop')) disarm()
  }, true)
  paint()
  if (!pack) nameInput.focus()
  return m
}
