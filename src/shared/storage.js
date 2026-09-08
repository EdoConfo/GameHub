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

export function get(key, fallback = null) {
  const full = PREFIX + key
  try {
    const raw = available ? localStorage.getItem(full) : memory.get(full)
    if (raw == null) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function set(key, value) {
  const full = PREFIX + key
  const raw = JSON.stringify(value)
  try {
    if (available) localStorage.setItem(full, raw)
    else memory.set(full, raw)
  } catch {
    // Quota or serialization issue: keep in memory so the session still works.
    memory.set(full, raw)
  }
}

export function remove(key) {
  const full = PREFIX + key
  try {
    if (available) localStorage.removeItem(full)
    else memory.delete(full)
  } catch {
    memory.delete(full)
  }
}
