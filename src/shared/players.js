// Shared player profiles — the common "accounts" DB across all games.
// Profile: { id, name, color, emoji }. Persisted in localStorage.
import * as storage from './storage.js'

const KEY = 'players'

export const COLORS = [
  '#6d5efc', '#ff6079', '#37c98f', '#e6b23a', '#3aa0ff',
  '#ff8f3a', '#c46bff', '#2fd0c8', '#ff5db1', '#9bd13a'
]
export const EMOJIS = [
  '🦊', '🐼', '🐧', '🦁', '🐸', '🐙', '🦄', '🐝',
  '🐬', '🦉', '🐨', '🐢', '🦖', '🐳', '🦋', '🐺'
]

function newId() {
  return 'p-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function load() {
  const raw = storage.get(KEY, [])
  if (!Array.isArray(raw)) return []
  let changed = false
  const out = raw.map((item, i) => {
    // Migrate old plain-string names into profiles.
    if (typeof item === 'string') {
      changed = true
      return { id: newId(), name: item.trim(), color: COLORS[i % COLORS.length], emoji: EMOJIS[i % EMOJIS.length] }
    }
    if (item && typeof item === 'object' && item.name) {
      return {
        id: item.id || newId(),
        name: String(item.name).trim(),
        color: item.color || COLORS[i % COLORS.length],
        // preserve an explicit emoji (including null = generic icon);
        // only legacy profiles without the key get a default.
        emoji: ('emoji' in item) ? (item.emoji || null) : EMOJIS[i % EMOJIS.length],
        photo: item.photo || null
      }
    }
    return null
  }).filter(Boolean)
  if (changed) save(out)
  return out
}

function save(list) { storage.set(KEY, list) }

export function all() { return load() }
export function get(id) { return load().find(p => p.id === id) || null }

// Pick a color/emoji not already used (falls back to index cycling).
function nextColor(list) { return COLORS.find(c => !list.some(p => p.color === c)) || COLORS[list.length % COLORS.length] }
function nextEmoji(list) { return EMOJIS.find(e => !list.some(p => p.emoji === e)) || EMOJIS[list.length % EMOJIS.length] }

export function add({ name, color, emoji, photo } = {}) {
  const clean = String(name || '').trim()
  if (!clean) return null
  const list = load()
  const profile = {
    id: newId(),
    name: clean,
    color: color || nextColor(list),
    emoji: emoji || null, // no emoji by default -> generic user icon
    photo: photo || null
  }
  list.push(profile)
  save(list)
  return profile
}

export function update(id, patch = {}) {
  const list = load()
  const p = list.find(x => x.id === id)
  if (!p) return null
  if (patch.name != null) p.name = String(patch.name).trim() || p.name
  if (patch.color) p.color = patch.color
  if ('emoji' in patch) p.emoji = patch.emoji || null // null clears -> generic icon
  if ('photo' in patch) p.photo = patch.photo || null // null removes the photo
  save(list)
  return p
}

export function remove(id) {
  save(load().filter(p => p.id !== id))
}

export function suggest() {
  const list = load()
  return { color: nextColor(list), emoji: nextEmoji(list) }
}
