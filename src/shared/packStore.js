// Generic per-game pack store. Each game creates its own instance with its own
// bundled JSON packs, its own localStorage namespace, and a "codec" that knows
// the shape of that game's items (Mister White = pairs, Heads Up = words).
//
// Word packs are NOT shared between games: a store is scoped by `namespace`.
import * as storage from './storage.js'

export function createPackStore({ namespace, bundledModules, codec, enableAllByDefault = false }) {
  const CUSTOM_KEY = `packs:${namespace}:custom`
  const ENABLED_KEY = `packs:${namespace}:enabled`

  const bundled = Object.values(bundledModules)
    .map(m => m.default)
    .map(normalizePack)
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name, 'it'))

  function normalizePack(raw) {
    if (!raw || typeof raw !== 'object') return null
    const id = String(raw.id || '').trim()
    const name = String(raw.name || '').trim()
    if (!id || !name) return null
    const rawItems = raw.items || raw[codec.field] || []
    const items = normalizeItems(rawItems)
    if (!items.length) return null
    return { id, name, language: raw.language || 'it', items, custom: !!raw.custom }
  }

  function normalizeItems(list) {
    if (!Array.isArray(list)) return []
    const seen = new Set()
    const out = []
    for (const raw of list) {
      const item = codec.normalize(raw)
      if (item == null) continue
      const key = codec.key(item)
      if (seen.has(key)) continue
      seen.add(key)
      out.push(item)
    }
    return out
  }

  function loadCustom() {
    const list = storage.get(CUSTOM_KEY, [])
    return Array.isArray(list) ? list.map(normalizePack).filter(Boolean) : []
  }
  function saveCustom(list) { storage.set(CUSTOM_KEY, list) }

  function allPacks() { return [...bundled, ...loadCustom()] }
  function getPack(id) { return allPacks().find(p => p.id === id) || null }

  function defaultEnabled() {
    if (enableAllByDefault) return allPacks().map(p => p.id)
    const preferred = bundled.find(p => p.id === 'default') || bundled[0]
    return preferred ? [preferred.id] : []
  }

  function enabledIds() {
    const stored = storage.get(ENABLED_KEY, null)
    if (Array.isArray(stored)) {
      const valid = new Set(allPacks().map(p => p.id))
      const kept = stored.filter(id => valid.has(id))
      return kept
    }
    return defaultEnabled()
  }

  function setEnabled(ids) { storage.set(ENABLED_KEY, [...new Set(ids)]) }

  function toggleEnabled(id) {
    const current = new Set(enabledIds())
    if (current.has(id)) current.delete(id)
    else current.add(id)
    setEnabled([...current])
    return [...current]
  }

  function enabledPacks() {
    const ids = new Set(enabledIds())
    return allPacks().filter(p => ids.has(p.id))
  }

  // Pooled items from all enabled packs, de-duplicated.
  function enabledItems() {
    const seen = new Set()
    const pool = []
    for (const pack of enabledPacks()) {
      for (const item of pack.items) {
        const key = codec.key(item)
        if (seen.has(key)) continue
        seen.add(key)
        pool.push(item)
      }
    }
    return pool
  }

  // Parse custom input: JSON (schema or bare array) or the line format.
  // Returns { items } or throws Error with an Italian message.
  function parsePackInput(text) {
    const trimmed = String(text || '').trim()
    if (!trimmed) throw new Error('Il testo è vuoto.')

    let items = null
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      let data
      try { data = JSON.parse(trimmed) } catch { throw new Error('JSON non valido. Controlla la sintassi.') }
      let rawItems
      if (Array.isArray(data)) rawItems = data
      else if (data && (Array.isArray(data.items) || Array.isArray(data[codec.field]))) rawItems = data.items || data[codec.field]
      else throw new Error(`JSON senza campo "${codec.field}" valido.`)
      items = normalizeItems(rawItems)
    } else {
      items = normalizeItems(trimmed.split(/\r?\n/).map(codec.parseLine))
    }

    if (!items || !items.length) throw new Error(codec.emptyMsg)
    return { items }
  }

  function addCustomPack(name, text) {
    const cleanName = String(name || '').trim()
    if (!cleanName) throw new Error('Dai un nome al pacchetto.')
    const { items } = parsePackInput(text)
    const id = 'custom-' + Date.now().toString(36)
    const pack = { id, name: cleanName, language: 'it', items, custom: true }
    const list = loadCustom()
    list.push(pack)
    saveCustom(list)
    setEnabled([...new Set([...enabledIds(), id])])
    return pack
  }

  function deleteCustomPack(id) {
    saveCustom(loadCustom().filter(p => p.id !== id))
    setEnabled(enabledIds().filter(x => x !== id))
  }

  return {
    namespace,
    unit: codec.unit || 'voci',
    placeholder: codec.placeholder || '',
    allPacks, getPack,
    enabledIds, setEnabled, toggleEnabled, enabledPacks, enabledItems,
    parsePackInput, addCustomPack, deleteCustomPack
  }
}
