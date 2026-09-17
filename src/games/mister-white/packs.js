// Mister White word packs: pairs { civilian, undercover }. Scoped to this game.
// Each pack file carries one list per language (see shared/packStore.js).
import { createPackStore } from '../../shared/packStore.js'
import { remotePack } from '../../shared/remotePacks.js'
import { LANGS } from '../../shared/i18n.js'

// Base comes from the database, not from the code: its words aren't in the
// public repository, and they can be revised without shipping a new version.
//
// One row is one pair, in every language at once — civilian_it, undercover_it,
// civilian_en, … — and the database won't take a row with a language missing.
// So every language has the same pairs, the same count, and the same game.
const base = remotePack({
  key: 'mw-base',
  table: 'mw_base',
  select: LANGS.flatMap(l => [`civilian_${l}`, `undercover_${l}`]).join(','),
  build(rows) {
    const pairs = Object.fromEntries(LANGS.map(l => [l, []]))
    for (const r of rows) {
      for (const l of LANGS) pairs[l].push({ civilian: r[`civilian_${l}`], undercover: r[`undercover_${l}`] })
    }
    return { id: 'base', icon: 'words', name: Object.fromEntries(LANGS.map(l => [l, 'Base'])), pairs }
  }
})

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

// One built-in pack, Base, holding every pair the game ships with. It used to be
// five themed ones — Animali, Cibo, Film… — and picking one told the whole table
// what the word was about, which hands Mister White, the one player without a
// word, most of the answer. A pool with no theme gives nothing away. Your own
// packs still sit beside it, and can still be switched on for a match.
export default createPackStore({
  namespace: 'mister-white', codec, remote: base,
  lockBundled: true,
  legacyIds: { from: ['default', 'animali', 'cibo', 'film', 'sport'], to: 'base' }
})
