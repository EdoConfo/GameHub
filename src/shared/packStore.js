// Generic per-game pack store. Each game creates its own instance with its own
// bundled JSON packs, its own localStorage namespace, and a "codec" that knows
// the shape of that game's items (Mister White = pairs, Heads Up = words).
//
// Word packs are NOT shared between games: a store is scoped by `namespace`.
// Every pack can be renamed and rewritten: custom packs change in place,
// built-in ones keep the change aside (an override by pack id) so they can be
// put back as they were.
//
// LANGUAGES — a pack holds one list per language, side by side in the same file:
//   { "id": "animali",
//     "name":  { "it": "Animali", "en": "Animals" },
//     "words": { "it": [...],     "en": [...] } }
// Adding a language means appending one block, never touching the others. The
// lists are independent: the English one doesn't have to translate the Italian
// one word for word. A pack without the active language is hidden — no Italian
// words surfacing in an English game.
//
// The old flat shape ({ "language": "it", "words": [...] }) still loads, read as
// that one language, so packs already saved on a phone keep working.
import * as storage from './storage.js'
import { t, getLang, getLocale } from './i18n.js'

export function createPackStore({ namespace, bundledModules, codec, enableAllByDefault = false, selectable = false }) {
  const CUSTOM_KEY = `packs:${namespace}:custom`
  const ENABLED_KEY = `packs:${namespace}:enabled`
  const OVERRIDE_KEY = `packs:${namespace}:overrides`

  const bundled = Object.values(bundledModules)
    .map(m => m.default)
    .map(normalizePack)
    .filter(Boolean)

  // ---- internal shape: { id, names: {lang: str}, byLang: {lang: [items]} } ----
  function normalizePack(raw) {
    if (!raw || typeof raw !== 'object') return null
    const id = String(raw.id || '').trim()
    if (!id) return null
    const fallbackLang = String(raw.language || 'it').slice(0, 2).toLowerCase()

    const names = {}
    if (raw.name && typeof raw.name === 'object') {
      for (const [lang, value] of Object.entries(raw.name)) {
        const clean = String(value || '').trim()
        if (clean) names[lang] = clean
      }
    } else if (String(raw.name || '').trim()) {
      names[fallbackLang] = String(raw.name).trim()
    }

    const source = raw.items || raw[codec.field] || []
    const byLang = {}
    if (Array.isArray(source)) {
      const items = normalizeItems(source)
      if (items.length) byLang[fallbackLang] = items
    } else if (source && typeof source === 'object') {
      for (const [lang, list] of Object.entries(source)) {
        const items = normalizeItems(list)
        if (items.length) byLang[lang] = items
      }
    }

    const langs = Object.keys(byLang)
    if (!langs.length || !Object.keys(names).length) return null
    return { id, names, byLang, custom: !!raw.custom }
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

  // A pack as the rest of the app wants it: one language, flat. Null when this
  // pack doesn't speak it.
  function resolve(pack, lang, extra = {}) {
    const items = pack.byLang[lang]
    if (!items || !items.length) return null
    return {
      id: pack.id,
      name: pack.names[lang] || pack.names[Object.keys(pack.names)[0]],
      language: lang,
      langs: Object.keys(pack.byLang),
      items,
      custom: pack.custom,
      ...extra
    }
  }

  function loadCustom() {
    const list = storage.get(CUSTOM_KEY, [])
    return Array.isArray(list) ? list.map(normalizePack).filter(Boolean) : []
  }
  function saveCustom(list) {
    storage.set(CUSTOM_KEY, list.map(p => ({ id: p.id, name: p.names, items: p.byLang, custom: true })))
  }

  // { [packId]: { [lang]: { name, items } } }. The old { name, items } shape is
  // read as an Italian override.
  function loadOverrides() {
    const raw = storage.get(OVERRIDE_KEY, {})
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
    const out = {}
    for (const [id, value] of Object.entries(raw)) {
      if (!value || typeof value !== 'object') continue
      out[id] = Array.isArray(value.items) || typeof value.name === 'string'
        ? { it: value }
        : value
    }
    return out
  }
  function saveOverrides(o) { storage.set(OVERRIDE_KEY, o) }

  // Built-in packs with their edits laid over (marked `modified`), then yours —
  // all in the active language, packs that don't speak it left out.
  function allPacks() {
    const lang = getLang()
    const over = loadOverrides()
    const out = []
    for (const pack of bundled) {
      const edit = over[pack.id] && over[pack.id][lang]
      if (!edit) { const r = resolve(pack, lang); if (r) out.push(r); continue }
      const items = normalizeItems(edit.items)
      const r = resolve(
        { ...pack, names: { ...pack.names, [lang]: String(edit.name || pack.names[lang] || '') },
          byLang: { ...pack.byLang, [lang]: items.length ? items : pack.byLang[lang] } },
        lang,
        { modified: true }
      )
      if (r) out.push(r)
    }
    out.sort((a, b) => a.name.localeCompare(b.name, getLocale()))
    for (const pack of loadCustom()) {
      const r = resolve(pack, lang)
      if (r) out.push(r)
    }
    return out
  }

  function getPack(id) { return allPacks().find(p => p.id === id) || null }

  function defaultEnabled() {
    if (enableAllByDefault) return allPacks().map(p => p.id)
    const list = allPacks()
    const preferred = list.find(p => p.id === 'default') || list[0]
    return preferred ? [preferred.id] : []
  }

  // What's stored, untouched — may name packs of other languages, and must stay
  // that way: switching language and back must not wipe your choices.
  function storedEnabled() {
    const stored = storage.get(ENABLED_KEY, null)
    return Array.isArray(stored) ? stored : null
  }

  function enabledIds() {
    const stored = storedEnabled()
    if (!stored) return defaultEnabled()
    const valid = new Set(allPacks().map(p => p.id))
    return stored.filter(id => valid.has(id))
  }

  function setEnabled(ids) { storage.set(ENABLED_KEY, [...new Set(ids)]) }

  function toggleEnabled(id) {
    const base = storedEnabled() || defaultEnabled()
    const current = new Set(base)
    if (current.has(id)) current.delete(id)
    else current.add(id)
    setEnabled([...current])
    return enabledIds()
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
  // Returns { items } or throws Error with a translated message.
  function parsePackInput(text) {
    const trimmed = String(text || '').trim()
    if (!trimmed) throw new Error(t('packs.emptyText'))

    let items = null
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      let data
      try { data = JSON.parse(trimmed) } catch { throw new Error(t('packs.badJson')) }
      let rawItems
      if (Array.isArray(data)) rawItems = data
      else if (data && (Array.isArray(data.items) || Array.isArray(data[codec.field]))) rawItems = data.items || data[codec.field]
      else throw new Error(t('packs.missingField', { field: codec.field }))
      items = normalizeItems(rawItems)
    } else {
      items = normalizeItems(trimmed.split(/\r?\n/).map(codec.parseLine))
    }

    if (!items || !items.length) throw new Error(t(codec.emptyKey))
    return { items }
  }

  // A pack's items as editable text, one per line (the format parsePackInput reads).
  function toText(pack) { return pack.items.map(it => (codec.toLine ? codec.toLine(it) : String(it))).join('\n') }

  function cleanName(name) {
    const clean = String(name || '').trim()
    if (!clean) throw new Error(t('packs.nameRequired'))
    return clean
  }

  // Packs you write are single-language: they're saved under the language that
  // was active while writing them, and show up only there.
  function addCustomPack(name, text, { enable = true } = {}) {
    const lang = getLang()
    const clean = cleanName(name)
    const { items } = parsePackInput(text)
    const id = 'custom-' + Date.now().toString(36)
    const pack = { id, names: { [lang]: clean }, byLang: { [lang]: items }, custom: true }
    const list = loadCustom()
    list.push(pack)
    saveCustom(list)
    if (enable) setEnabled([...new Set([...(storedEnabled() || defaultEnabled()), id])])
    return resolve(pack, lang)
  }

  // Rename / rewrite a pack — in the active language only, the other languages
  // of a built-in pack stay as they came.
  function updatePack(id, { name, text }) {
    const lang = getLang()
    const clean = cleanName(name)
    const { items } = parsePackInput(text)
    const list = loadCustom()
    const i = list.findIndex(p => p.id === id)
    if (i >= 0) {
      list[i] = {
        ...list[i],
        names: { ...list[i].names, [lang]: clean },
        byLang: { ...list[i].byLang, [lang]: items }
      }
      saveCustom(list)
      return resolve(list[i], lang)
    }
    if (!bundled.some(p => p.id === id)) throw new Error(t('packs.notFound'))
    const over = loadOverrides()
    over[id] = { ...(over[id] || {}), [lang]: { name: clean, items } }
    saveOverrides(over)
    return getPack(id)
  }

  // A built-in pack back as it came with the app, in this language.
  function resetPack(id) {
    const lang = getLang()
    const over = loadOverrides()
    if (over[id]) {
      delete over[id][lang]
      if (!Object.keys(over[id]).length) delete over[id]
    }
    saveOverrides(over)
  }

  function deleteCustomPack(id) {
    saveCustom(loadCustom().filter(p => p.id !== id))
    setEnabled((storedEnabled() || defaultEnabled()).filter(x => x !== id))
  }

  return {
    namespace,
    selectable, // are packs switched on and off (Heads Up), or picked at the table (Mister White)?
    // live: these follow the interface language
    get unit() { return t(codec.unitKey || 'packs.unit.items') },
    get placeholder() { return t(codec.placeholderKey || '') },
    allPacks, getPack,
    enabledIds, setEnabled, toggleEnabled, enabledPacks, enabledItems,
    parsePackInput, toText, addCustomPack, updatePack, resetPack, deleteCustomPack
  }
}
