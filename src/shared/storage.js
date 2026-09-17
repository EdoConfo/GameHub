// Namespaced localStorage wrapper. All persistent state goes through here.
// Safe against private-mode / disabled storage: falls back to in-memory.

const PREFIX = 'gamehub:'
const memory = new Map()
let available = true

try {
  const k = PREFIX + '__test__'
  localStorage.setItem(k, '1')
  localStorage.removeItem(k)
} catch {
  available = false
}

// Told once, when a write doesn't fit. Until then a full storage was silent:
// the value went to memory and the next read went to localStorage, which still
// held the old one — the write looked done and simply wasn't.
const fullWatchers = new Set()
let warned = false
export function onStorageFull(fn) { fullWatchers.add(fn); return () => fullWatchers.delete(fn) }

export function get(key, fallback = null) {
  const full = PREFIX + key
  try {
    // A value that couldn't be written out is still the newest one this session.
    const raw = memory.has(full) ? memory.get(full) : available ? localStorage.getItem(full) : null
    if (raw == null) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

// -> true when the value is actually stored, false when it only lives in memory
// for this session (storage disabled, or full).
export function set(key, value) {
  const name = PREFIX + key
  const raw = JSON.stringify(value)
  if (!available) { memory.set(name, raw); return false }
  try {
    localStorage.setItem(name, raw)
    memory.delete(name)
    return true
  } catch {
    // Most likely full. Keep it for this session, and say so once.
    memory.set(name, raw)
    if (!warned) { warned = true; for (const fn of fullWatchers) fn() }
    return false
  }
}

export function remove(key) {
  const name = PREFIX + key
  memory.delete(name)
  try { if (available) localStorage.removeItem(name) } catch { /* nothing to free */ }
}
