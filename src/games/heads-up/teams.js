// Who plays with whom.
//
// Heads Up is the one game here that has sides: one player holds the phone on
// their forehead and their own team shouts the clues. So the table has a job it
// doesn't have anywhere else — saying, at a glance, where the line runs.
//
// The split belongs to the TABLE, not to the people: the same group with the
// chairs rearranged is a different split. So it's stored by seat id, and a
// chair that loses its player simply stops playing. Mister White's table is the
// same table, and it neither knows nor cares about any of this.
import * as storage from '../../shared/storage.js'

const KEY = 'heads-up:teams'

export const MIN_TEAMS = 2
export const MAX_TEAMS = 4
// One holds the phone, at least one gives the clues. A team of one is a player
// staring at a word nobody can describe to them.
export const MIN_PER_TEAM = 2

function load() {
  const raw = storage.get(KEY, null)
  const count = Math.min(MAX_TEAMS, Math.max(MIN_TEAMS, Math.round(Number(raw && raw.count)) || MIN_TEAMS))
  const bySeat = raw && raw.bySeat && typeof raw.bySeat === 'object' && !Array.isArray(raw.bySeat) ? raw.bySeat : {}
  return { count, bySeat }
}

function save(next) { storage.set(KEY, next); return next }

export function count() { return load().count }

export function setCount(n) {
  const { bySeat } = load()
  const count = Math.min(MAX_TEAMS, Math.max(MIN_TEAMS, Math.round(n) || MIN_TEAMS))
  // Anyone parked on a team that no longer exists goes back to the suggestion
  // rather than disappearing from the game.
  const kept = {}
  for (const [id, team] of Object.entries(bySeat)) if (team < count) kept[id] = team
  return save({ count, bySeat: kept })
}

// Only the chairs with somebody on them play. Seat order is the order the phone
// goes round, so the suggested split is CONTIGUOUS — halves of the circle, not
// every other chair. That's how people sit when they pick sides, and two arcs
// read at a glance where a chequerboard doesn't.
//   -> Map seatId -> team index
export function assign(seats) {
  const { count, bySeat } = load()
  const playing = seats.filter(s => s.pid)
  const out = new Map()
  playing.forEach((seat, i) => {
    const saved = bySeat[seat.id]
    const ok = Number.isInteger(saved) && saved >= 0 && saved < count
    out.set(seat.id, ok ? saved : Math.floor((i * count) / playing.length))
  })
  return out
}

// Tap a seat and it moves to the next team, wrapping. Whatever the other chairs
// were only suggested, they're written down now: otherwise moving one person
// would silently re-deal everybody else as the suggestion shifted under them.
export function cycle(seats, seatId) {
  const { count } = load()
  const current = assign(seats)
  if (!current.has(seatId)) return current
  const bySeat = {}
  for (const [id, team] of current) bySeat[id] = id === seatId ? (team + 1) % count : team
  save({ count, bySeat })
  return assign(seats)
}

// Back to halves of the circle, forgetting every tap.
export function reset() { return save({ count: load().count, bySeat: {} }) }

// The people of each team, in seat order.
//   -> [[player, …], …], one entry per team
export function rosters(seats, players) {
  const roster = new Map(players.map(p => [p.id, p]))
  const teams = assign(seats)
  const out = Array.from({ length: load().count }, () => [])
  for (const seat of seats) {
    if (!seat.pid) continue
    const player = roster.get(seat.pid)
    const team = teams.get(seat.id)
    if (player && team != null) out[team].push(player)
  }
  return out
}

// How many play on each team, by index.
export function sizes(seats) {
  const per = Array.from({ length: load().count }, () => 0)
  for (const team of assign(seats).values()) per[team]++
  return per
}

// Which teams haven't got enough people to play, by index. Empty means the
// table is ready. The caller names them: "not enough players" leaves you
// counting chairs, "Squadra 2 needs one more" doesn't.
export function short(seats) {
  return sizes(seats).map((n, i) => (n < MIN_PER_TEAM ? i : -1)).filter(i => i >= 0)
}
