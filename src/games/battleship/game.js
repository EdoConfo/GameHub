// The match, as one phone holds it.
//
// Two admirals, two fleets, one sea each. Somebody has to know where every
// ship is — that's the only way a shot can be called hit or miss — and that
// somebody is this object: on the phone that opened the room when the match
// is played across two phones, on the only phone there is when it's passed
// across the table.
//
// Each player is only ever shown their own view of it (viewFor): their own
// fleet, the shots fired at it, and what their own shots found. The other
// fleet stays here, and comes out ship by ship as it sinks — all of it only
// when the match is over.
//
// No DOM in this file: room.js, guest.js and local.js draw it.
import { SIZE, validFleet, tidy, shipAt, isSunk, allSunk } from './engine.js'

export const PLAYERS = 2

//   onChange(): something moved — broadcast it and redraw
export function createGame({ onChange = () => {} } = {}) {
  const state = {
    v: 0,
    phase: 'lobby',   // lobby · place · battle · over
    players: [],      // { pid, name, color, emoji }
    fleets: {},       // pid -> ships, once that player is ready
    fired: {},        // pid -> [{ r, c, hit }] — the shots that player fired
    first: Math.random() < 0.5 ? 0 : 1, // who fires first this match
    turn: null,       // pid
    last: null,       // { by, r, c, hit, sunk } — the shot everybody is reading
    winner: null      // pid
  }

  const changed = () => { state.v++; onChange() }
  const at = pid => state.players.findIndex(p => p.pid === pid)
  const foeOf = pid => {
    const p = state.players.find(x => x.pid !== pid)
    return p ? p.pid : null
  }

  function startPlacing() {
    state.fleets = {}
    state.fired = {}
    for (const p of state.players) state.fired[p.pid] = []
    state.turn = null
    state.last = null
    state.winner = null
    state.phase = 'place'
  }

  const api = {
    state,

    // ---- who is playing ----
    // The same profile coming back (a phone that locked its screen) is the
    // same admiral, with the same fleet still at sea.
    join({ pid, name, color, emoji }) {
      if (!pid || !name) return null
      const i = at(pid)
      if (i >= 0) {
        const p = state.players[i]
        if (p.name !== name || p.color !== color || p.emoji !== emoji) {
          Object.assign(p, { name, color, emoji })
          changed()
        }
        return p
      }
      if (state.phase !== 'lobby' || state.players.length >= PLAYERS) return null
      const p = { pid, name, color: color || null, emoji: emoji || null }
      state.players.push(p)
      changed()
      return p
    },

    leave(pid) {
      if (state.phase !== 'lobby') return
      const i = at(pid)
      if (i < 0) return
      state.players.splice(i, 1)
      changed()
    },

    ready() { return state.players.length === PLAYERS },

    begin() {
      if (state.phase !== 'lobby' || !api.ready()) return
      startPlacing()
      changed()
    },

    // ---- the fleets ----
    // A fleet handed in is final: there is no taking it back once the other
    // side may have seen that you're ready.
    place(pid, ships) {
      if (state.phase !== 'place' || at(pid) < 0 || state.fleets[pid]) return false
      if (!validFleet(ships)) return false
      state.fleets[pid] = tidy(ships)
      if (state.players.every(p => state.fleets[p.pid])) {
        state.turn = state.players[state.first].pid
        state.phase = 'battle'
      }
      changed()
      return true
    },

    placed: pid => !!state.fleets[pid],

    // ---- firing ----
    // A hit and you fire again; water and it's the other side's turn. That
    // is how it is played on paper, and it keeps a good guess rewarded.
    //   -> the shot, or null if it couldn't be fired
    fire(pid, r, c) {
      if (state.phase !== 'battle' || state.turn !== pid) return null
      if (!Number.isInteger(r) || !Number.isInteger(c)) return null
      if (r < 0 || c < 0 || r >= SIZE || c >= SIZE) return null
      const foe = foeOf(pid)
      const ships = state.fleets[foe]
      const mine = state.fired[pid]
      if (!ships || mine.some(s => s.r === r && s.c === c)) return null
      const hitAt = shipAt(ships, r, c)
      const shot = { r, c, hit: hitAt >= 0 }
      mine.push(shot)
      const sunk = hitAt >= 0 && isSunk(ships[hitAt], mine) ? ships[hitAt].len : 0
      state.last = { by: pid, r, c, hit: shot.hit, sunk }
      if (allSunk(ships, mine)) {
        state.winner = pid
        state.turn = null
        state.phase = 'over'
      } else if (!shot.hit) {
        state.turn = foe
      }
      changed()
      return state.last
    },

    // Same two admirals, fresh seas. Who fires first swaps, so a rematch is
    // a rematch.
    again() {
      if (state.phase !== 'over') return
      state.first = 1 - state.first
      startPlacing()
      changed()
    },

    // ---- what one player may see ----
    viewFor(pid) {
      const foe = foeOf(pid)
      const mine = state.fleets[pid] || null
      const theirs = foe ? state.fleets[foe] || null : null
      const outgoing = state.fired[pid] || []
      const incoming = foe ? state.fired[foe] || [] : []
      const over = state.phase === 'over'
      const placed = {}
      for (const p of state.players) placed[p.pid] = !!state.fleets[p.pid]
      return {
        v: state.v,
        phase: state.phase,
        players: state.players.map(p => ({ pid: p.pid, name: p.name, color: p.color, emoji: p.emoji })),
        me: pid,
        foe,
        placed,
        turn: state.turn,
        fleet: mine,
        incoming,
        outgoing,
        // the other fleet, ship by ship as it goes down — and the rest of
        // it once nothing can be gained from seeing it
        foeShips: theirs ? theirs.filter(s => over || isSunk(s, outgoing)) : [],
        foeAfloat: theirs ? theirs.filter(s => !isSunk(s, outgoing)).length : null,
        myAfloat: mine ? mine.filter(s => !isSunk(s, incoming)).length : null,
        last: state.last,
        winner: state.winner
      }
    }
  }

  return api
}
