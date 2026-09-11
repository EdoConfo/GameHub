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

// Move the chair at `from` so it ends up at `to`; the others shift round.
export function move(from, to) {
  const list = load()
  if (from < 0 || from >= list.length) return list
  const [s] = list.splice(from, 1)
  list.splice(Math.max(0, Math.min(list.length, to)), 0, s)
  return save(list)
}
