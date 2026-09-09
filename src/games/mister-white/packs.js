// Mister White word packs: pairs { civilian, undercover }. Scoped to this game.
import { createPackStore } from '../../shared/packStore.js'

const modules = import.meta.glob('./packs/*.json', { eager: true })

const codec = {
  field: 'pairs',
  unit: 'coppie',
  placeholder: 'Una coppia per riga:\ncane,lupo\npizza,focaccia\n\n…oppure JSON: { "pairs": [ { "civilian": "cane", "undercover": "lupo" } ] }',
  emptyMsg: 'Nessuna coppia valida. Formato: "parola,parola-simile" per riga.',
  normalize(raw) {
    if (!raw || typeof raw !== 'object') return null
    const civilian = String(raw.civilian || '').trim()
    const undercover = String(raw.undercover || '').trim()
    if (!civilian || !undercover) return null
    return { civilian, undercover }
  },
  key(it) { return (it.civilian + '|' + it.undercover).toLowerCase() },
  parseLine(line) {
    const p = String(line).split(/[,;\t]/).map(s => s.trim())
    if (p.length < 2 || !p[0] || !p[1]) return null
    return { civilian: p[0], undercover: p[1] }
  }
}

export default createPackStore({ namespace: 'mister-white', bundledModules: modules, codec })
