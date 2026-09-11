// Generic per-game pack store. Each game creates its own instance with its own
// bundled JSON packs, its own localStorage namespace, and a "codec" that knows
// the shape of that game's items (Mister White = pairs, Heads Up = words).
//
// Word packs are NOT shared between games: a store is scoped by `namespace`.
// Every pack can be renamed and rewritten: custom packs change in place,
// built-in ones keep the change aside (an override by pack id) so they can be
// put back as they were.
import * as storage from './storage.js'

export function createPackStore({ namespace, bundledModules, codec, enableAllByDefault = false }) {
  const CUSTOM_KEY = `packs:${namespace}:custom`
  const ENABLED_KEY = `packs:${namespace}:enabled`
  const OVERRIDE_KEY = `packs:${namespace}:overrides`

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

  function loadOverrides() {
    const o = storage.get(OVERRIDE_KEY, {})
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {}
  }
  function saveOverrides(o) { storage.set(OVERRIDE_KEY, o) }

  // Built-in packs with their edits laid over (marked `modified`), then yours.
  function allPacks() {
    const over = loadOverrides()
    const base = bundled.map(p => {
      const o = over[p.id]
      if (!o) return p
      const items = normalizeItems(o.items)
      return { ...p, name: String(o.name || p.name), items: items.length ? items : p.items, modified: true }
    })
    return [...base, ...loadCustom()]
  }
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
      return stored.filter(id => valid.has(id))
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

  // A pack's items as editable text, one per line (the format parsePackInput reads).
  function toText(pack) { return pack.items.map(it => (codec.toLine ? codec.toLine(it) : String(it))).join('\n') }

  function cleanName(name) {
    const clean = String(name || '').trim()
    if (!clean) throw new Error('Dai un nome al pacchetto.')
    return clean
  }

  // enable: also switch it on (games that pick packs in the manager). Mister
  // White picks them at the table, so a new pack starts off there.
  function addCustomPack(name, text, { enable = true } = {}) {
    const clean = cleanName(name)
    const { items } = parsePackInput(text)
    const id = 'custom-' + Date.now().toString(36)
    const pack = { id, name: clean, language: 'it', items, custom: true }
    const list = loadCustom()
    list.push(pack)
    saveCustom(list)
    if (enable) setEnabled([...new Set([...enabledIds(), id])])
    return pack
  }

  // Rename / rewrite any pack.
  function updatePack(id, { name, text }) {
    const clean = cleanName(name)
    const { items } = parsePackInput(text)
    const list = loadCustom()
    const i = list.findIndex(p => p.id === id)
    if (i >= 0) {
      list[i] = { ...list[i], name: clean, items }
      saveCustom(list)
      return list[i]
    }
    if (!bundled.some(p => p.id === id)) throw new Error('Pacchetto non trovato.')
    const over = loadOverrides()
    over[id] = { name: clean, items }
    saveOverrides(over)
    return getPack(id)
  }

  // A built-in pack back as it came with the app.
  function resetPack(id) {
    const over = loadOverrides()
    delete over[id]
    saveOverrides(over)
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
    parsePackInput, toText, addCustomPack, updatePack, resetPack, deleteCustomPack
  }
}
