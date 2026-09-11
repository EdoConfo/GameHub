// The table: who sits where, in the order the phone goes round (clockwise
// from the bottom seat, the phone holder's). One table for every game — same group, same chairs —
// remembered between sessions. Seat: { id, pid }; pid null = an empty chair,
// taken by whoever gets the phone there (they make their profile on the spot).
import * as storage from './storage.js'
import * as players from './players.js'

const KEY = 'table'
const newId = () => 's-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

function load() {
  const raw = storage.get(KEY, null)
  let list
  if (Array.isArray(raw)) {
    list = raw.filter(s => s && s.id).map(s => ({ id: s.id, pid: s.pid || null }))
  } else {
    // First time: seat part of the roster, pad with empty chairs.
    list = players.all().slice(0, 6).map(p => ({ id: newId(), pid: p.id }))
    while (list.length < 4) list.push({ id: newId(), pid: null })
  }
  // A deleted profile leaves its chair empty; nobody sits twice.
  const known = new Set(players.all().map(p => p.id))
  const seen = new Set()
  for (const s of list) {
    if (s.pid && (!known.has(s.pid) || seen.has(s.pid))) s.pid = null
    if (s.pid) seen.add(s.pid)
  }
  return list
}

function save(list) { storage.set(KEY, list); return list }

export function seats() { return load() }

export function addSeat(pid = null) {
  const list = load()
  if (pid) for (const s of list) if (s.pid === pid) s.pid = null
  list.push({ id: newId(), pid })
  return save(list)
}

export function removeSeat(id) { return save(load().filter(s => s.id !== id)) }

// Sit someone on a chair. If they were sitting elsewhere, that chair empties.
export function sit(id, pid) {
  const list = load()
  if (pid) for (const s of list) if (s.pid === pid) s.pid = null
  const seat = list.find(s => s.id === id)
  if (seat) seat.pid = pid || null
  return save(list)
}

// Swap two chairs (with whoever sits on them); nobody else moves.
export function swap(a, b) {
  const list = load()
  if (!list[a] || !list[b]) return list
  ;[list[a], list[b]] = [list[b], list[a]]
  return save(list)
}

// Turn the whole table k places clockwise: same order, a new seat at the bottom.
export function rotate(k) {
  const list = load()
  const n = list.length
  const out = new Array(n)
  list.forEach((s, i) => { out[(((i + k) % n) + n) % n] = s })
  return save(out)
}
