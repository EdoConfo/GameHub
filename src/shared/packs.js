// Word-pack manager. Usable by any word-based game.
// Bundled packs live in src/packs/*.json and are imported at build time
// (so the service worker precaches them -> fully offline).
// Custom packs are user-provided and stored in localStorage.
import * as storage from './storage.js'

const CUSTOM_KEY = 'packs:custom'
const ENABLED_KEY = 'packs:enabled'

// Eager glob import -> objects are bundled, no runtime fetch.
const modules = import.meta.glob('../packs/*.json', { eager: true })
const bundled = Object.values(modules)
  .map(m => m.default)
  .map(normalizePack)
  .filter(Boolean)
  .sort((a, b) => a.name.localeCompare(b.name, 'it'))

function normalizePack(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = String(raw.id || '').trim()
  const name = String(raw.name || '').trim()
  if (!id || !name) return null
  const pairs = normalizePairs(raw.pairs)
  if (!pairs.length) return null
  return { id, name, language: raw.language || 'it', pairs, custom: !!raw.custom }
}

function normalizePairs(pairs) {
  if (!Array.isArray(pairs)) return []
  const seen = new Set()
  const out = []
  for (const p of pairs) {
    if (!p) continue
    const civilian = String(p.civilian || '').trim()
    const undercover = String(p.undercover || '').trim()
    if (!civilian || !undercover) continue
    const key = (civilian + '|' + undercover).toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ civilian, undercover })
  }
  return out
}

function loadCustom() {
  const list = storage.get(CUSTOM_KEY, [])
  return Array.isArray(list) ? list.map(normalizePack).filter(Boolean) : []
}

function saveCustom(list) {
  storage.set(CUSTOM_KEY, list)
}

// ---- Public API ----

export function allPacks() {
  return [...bundled, ...loadCustom()]
}

export function getPack(id) {
  return allPacks().find(p => p.id === id) || null
}

export function enabledIds() {
  const stored = storage.get(ENABLED_KEY, null)
  if (Array.isArray(stored) && stored.length) {
    // Keep only ids that still exist.
    const valid = new Set(allPacks().map(p => p.id))
    const kept = stored.filter(id => valid.has(id))
    return kept.length ? kept : defaultEnabled()
  }
  return defaultEnabled()
}

function defaultEnabled() {
  // Enable the first bundled pack by default (the long default deck).
  return bundled.length ? [bundled.find(p => p.id === 'default')?.id || bundled[0].id] : []
}

export function setEnabled(ids) {
  storage.set(ENABLED_KEY, [...new Set(ids)])
}

export function toggleEnabled(id) {
  const current = new Set(enabledIds())
  if (current.has(id)) current.delete(id)
  else current.add(id)
  setEnabled([...current])
  return [...current]
}

// Pooled pairs from all enabled packs, de-duplicated.
export function enabledPairs() {
  const ids = new Set(enabledIds())
  const seen = new Set()
  const pool = []
  for (const pack of allPacks()) {
    if (!ids.has(pack.id)) continue
    for (const pair of pack.pairs) {
      const key = (pair.civilian + '|' + pair.undercover).toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      pool.push(pair)
    }
  }
  return pool
}

// ---- Custom pack creation / deletion ----

// Parse either JSON (matching the pack schema, or a bare array of pairs)
// or the simple line format: "civilian,undercover" per line.
// Returns { pairs } or throws Error with an Italian message.
export function parsePackInput(text) {
  const trimmed = String(text || '').trim()
  if (!trimmed) throw new Error('Il testo è vuoto.')

  let pairs = null
  const looksJson = trimmed.startsWith('{') || trimmed.startsWith('[')
  if (looksJson) {
    let data
    try {
      data = JSON.parse(trimmed)
    } catch {
      throw new Error('JSON non valido. Controlla la sintassi.')
    }
    if (Array.isArray(data)) pairs = normalizePairs(data)
    else if (data && Array.isArray(data.pairs)) pairs = normalizePairs(data.pairs)
    else throw new Error('JSON senza campo "pairs" valido.')
  } else {
    // Line format.
    pairs = normalizePairs(
      trimmed.split(/\r?\n/).map(line => {
        const parts = line.split(/[,;\t]/).map(s => s.trim())
        if (parts.length < 2 || !parts[0] || !parts[1]) return null
        return { civilian: parts[0], undercover: parts[1] }
      })
    )
  }

  if (!pairs || !pairs.length) {
    throw new Error('Nessuna coppia valida trovata. Formato: "parola,parola-simile" per riga.')
  }
  return { pairs }
}

export function addCustomPack(name, text) {
  const cleanName = String(name || '').trim()
  if (!cleanName) throw new Error('Dai un nome al pacchetto.')
  const { pairs } = parsePackInput(text)
  const id = 'custom-' + Date.now().toString(36)
  const pack = { id, name: cleanName, language: 'it', pairs, custom: true }
  const list = loadCustom()
  list.push(pack)
  saveCustom(list)
  // Auto-enable the newly added pack.
  setEnabled([...new Set([...enabledIds(), id])])
  return pack
}

export function deleteCustomPack(id) {
  const list = loadCustom().filter(p => p.id !== id)
  saveCustom(list)
  setEnabled(enabledIds().filter(x => x !== id))
  return list
}

export function isCustom(id) {
  return loadCustom().some(p => p.id === id)
}
