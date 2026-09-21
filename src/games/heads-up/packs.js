// Heads Up word packs: single words/names to guess. Scoped to this game.
import { createPackStore } from '../../shared/packStore.js'
import { remotePack } from '../../shared/remotePacks.js'
import { LANGS } from '../../shared/i18n.js'

// The categories come from the database, not from the code: their words aren't
// in the public repository, and they can be revised without shipping a new
// version — the same move Mister White's Base made.
//
// Mister White collapsed his five themed packs into one hidden Base, because
// there the theme was a clue: it told the table what the word was about, which
// hands Mister White most of the answer. Here the category IS the game — you
// pick "Animali" and everyone knows it — so the categories stay, and stay
// separate. That's why this download is a list of packs and the Base is one.
//
// Two tables, then: the categories with their names, and the words inside them.
// One row is one word in every language at once — word_it, word_en — and the
// database won't take a row with a language missing, so a category has the same
// count in every language and everyone plays the same list.
const online = remotePack({
  key: 'hu-words',
  table: 'hu_words',
  select: ['pack', ...LANGS.map(l => `word_${l}`)].join(','),
  // hu_packs is keyed by text, so the filter that gives each revision its own
  // address rides on `sort`, which is a number and never negative.
  meta: { table: 'hu_packs', select: ['id', 'icon', 'sort', ...LANGS.map(l => `name_${l}`)].join(','), bustOn: 'sort' },
  build(rows, packs) {
    const byId = new Map()
    for (const p of packs || []) {
      byId.set(p.id, {
        id: p.id,
        icon: p.icon || 'words',
        sort: Number(p.sort) || 0,
        name: Object.fromEntries(LANGS.map(l => [l, p[`name_${l}`]])),
        words: Object.fromEntries(LANGS.map(l => [l, []]))
      })
    }
    // A word whose category was deleted mid-download belongs nowhere: it's
    // dropped rather than inventing a category with no name.
    for (const r of rows) {
      const pack = byId.get(r.pack)
      if (!pack) continue
      for (const l of LANGS) pack.words[l].push(r[`word_${l}`])
    }
    return [...byId.values()].sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id))
  }
})

const codec = {
  field: 'words',
  icon: 'words',
  // one word per row, so one column
  columns: [{ key: 'word', label: 'hu.unit.words' }],
  toRow(it) { return { word: it } },
  fromRow(row) { return String(row.word || '').trim() || null },
  unitKey: 'hu.unit.words',
  placeholderKey: 'hu.packsPlaceholder',
  emptyKey: 'hu.packsEmpty',
  normalize(raw) {
    const s = String(raw == null ? '' : (typeof raw === 'string' ? raw : (raw.word || ''))).trim()
    return s ? s : null
  },
  key(it) { return it.toLowerCase() },
  toLine(it) { return it },
  parseLine(line) {
    const s = String(line).trim()
    return s ? s : null
  }
}

// Heads Up plays one category at a time, so enable them all by default.
//
// The categories are played but not opened: reading the list is reading the
// answers, the same reason the Base stays shut. Your own packs still sit beside
// them and are still yours to write.
//
// The ids are the ones the app used to ship with — animali, cibo, film, mimo,
// personaggi — so a phone that had some switched on keeps exactly its choice,
// with nothing to migrate.
export default createPackStore({
  namespace: 'heads-up', codec, remote: online,
  lockBundled: true, enableAllByDefault: true, selectable: true
})
