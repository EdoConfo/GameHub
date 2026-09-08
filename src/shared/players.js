// Player roster shared across all games. Persisted in localStorage.
import * as storage from './storage.js'

const KEY = 'players'

function load() {
  const list = storage.get(KEY, [])
  return Array.isArray(list) ? list.filter(n => typeof n === 'string' && n.trim()) : []
}

function save(list) {
  storage.set(KEY, list)
}

export function all() {
  return load()
}

export function add(name) {
  const clean = String(name || '').trim()
  if (!clean) return load()
  const list = load()
  // Case-insensitive dedupe.
  if (list.some(n => n.toLowerCase() === clean.toLowerCase())) return list
  list.push(clean)
  save(list)
  return list
}

export function removeAt(index) {
  const list = load()
  if (index >= 0 && index < list.length) {
    list.splice(index, 1)
    save(list)
  }
  return list
}

export function rename(index, name) {
  const clean = String(name || '').trim()
  const list = load()
  if (clean && index >= 0 && index < list.length) {
    list[index] = clean
    save(list)
  }
  return list
}

export function clear() {
  save([])
  return []
}
