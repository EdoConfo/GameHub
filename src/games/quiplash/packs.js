// Quiplash prompts: one question per item ("Il peggior nome per un cane"),
// answered by two players at a time. Scoped to this game.
import { createPackStore } from '../../shared/packStore.js'
import { remotePack } from '../../shared/remotePacks.js'
import { LANGS } from '../../shared/i18n.js'

// The prompts come from the database, like Mister White's Base and Heads Up's
// categories: they aren't in the public repository, and they can be revised
// without shipping a new version of the app.
//
// One pack, not several, and hidden: a prompt read beforehand is a prompt
// somebody has already written the answer to. Packs you write yourself sit
// beside it and are yours to open.
//
// One row is one prompt in every language at once — text_it, text_en — and the
// database won't take a row with a language missing, so every language plays
// the same number of prompts.
const base = remotePack({
  key: 'ql-prompts',
  table: 'ql_prompts',
  select: LANGS.map(l => `text_${l}`).join(','),
  build(rows) {
    const prompts = Object.fromEntries(LANGS.map(l => [l, []]))
    for (const r of rows) for (const l of LANGS) prompts[l].push(r[`text_${l}`])
    return { id: 'base', icon: 'bubbles', name: Object.fromEntries(LANGS.map(l => [l, 'Base'])), prompts }
  }
})

const codec = {
  field: 'prompts',
  icon: 'bubbles',
  // one prompt per row, so one column
  columns: [{ key: 'prompt', label: 'ql.unit.prompts' }],
  toRow(it) { return { prompt: it } },
  fromRow(row) { return String(row.prompt || '').trim() || null },
  unitKey: 'ql.unit.prompts',
  placeholderKey: 'ql.packsPlaceholder',
  emptyKey: 'ql.packsEmpty',
  normalize(raw) {
    const s = String(raw == null ? '' : (typeof raw === 'string' ? raw : (raw.prompt || ''))).trim()
    return s || null
  },
  key(it) { return it.toLowerCase() },
  toLine(it) { return it },
  parseLine(line) {
    const s = String(line).trim()
    return s || null
  }
}

export default createPackStore({
  namespace: 'quiplash', codec, remote: base, lockBundled: true
})
