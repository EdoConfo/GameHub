// Heads Up word packs: single words/names to guess. Scoped to this game.
import { createPackStore } from '../../shared/packStore.js'

const modules = import.meta.glob('./packs/*.json', { eager: true })

const codec = {
  field: 'words',
  unit: 'parole',
  placeholder: 'Una parola per riga:\nSpiderman\nPizza\nBallare la macarena\n\n…oppure JSON: { "words": ["Spiderman", "Pizza"] }',
  emptyMsg: 'Nessuna parola valida. Scrivi una parola per riga.',
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
