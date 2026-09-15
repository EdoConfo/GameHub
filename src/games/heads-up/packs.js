// Heads Up word packs: single words/names to guess. Scoped to this game.
// Each pack file carries one list per language (see shared/packStore.js).
import { createPackStore } from '../../shared/packStore.js'

const modules = import.meta.glob('./packs/*.json', { eager: true })

const codec = {
  field: 'words',
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
export default createPackStore({ namespace: 'heads-up', bundledModules: modules, codec, enableAllByDefault: true })
