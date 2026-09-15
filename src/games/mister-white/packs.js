// Mister White word packs: pairs { civilian, undercover }. Scoped to this game.
// Each pack file carries one list per language (see shared/packStore.js).
import { createPackStore } from '../../shared/packStore.js'

const modules = import.meta.glob('./packs/*.json', { eager: true })

const codec = {
  field: 'pairs',
  icon: 'words',
  // what a row of the editor looks like: the civilians' word and the one the
  // Undercovers get. Mister White gets no word at all, so he has no column.
  columns: [
    { key: 'civilian', label: 'mw.roles.civili' },
    { key: 'undercover', label: 'mw.role.undercover' }
  ],
  toRow(it) { return { civilian: it.civilian, undercover: it.undercover } },
  fromRow(row) {
    const civilian = String(row.civilian || '').trim()
    const undercover = String(row.undercover || '').trim()
    return civilian && undercover ? { civilian, undercover } : null
  },
  unitKey: 'mw.unit.pairs',
  placeholderKey: 'mw.packsPlaceholder',
  emptyKey: 'mw.packsEmpty',
  normalize(raw) {
    if (!raw || typeof raw !== 'object') return null
    const civilian = String(raw.civilian || '').trim()
    const undercover = String(raw.undercover || '').trim()
    if (!civilian || !undercover) return null
    return { civilian, undercover }
  },
  key(it) { return (it.civilian + '|' + it.undercover).toLowerCase() },
  toLine(it) { return it.civilian + ', ' + it.undercover },
  parseLine(line) {
    const p = String(line).split(/[,;\t]/).map(s => s.trim())
    if (p.length < 2 || !p[0] || !p[1]) return null
    return { civilian: p[0], undercover: p[1] }
  }
}

export default createPackStore({ namespace: 'mister-white', bundledModules: modules, codec })
