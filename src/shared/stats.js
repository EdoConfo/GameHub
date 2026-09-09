// Per-game stats keyed by player profile id. Shared store, one bucket per game.
// Shape: stats:<gameId> = { [profileId]: { played, won } }
import * as storage from './storage.js'

function keyFor(gameId) { return 'stats:' + gameId }

export function get(gameId) {
  const data = storage.get(keyFor(gameId), {})
  return data && typeof data === 'object' ? data : {}
}

// Record one match: everyone in playerIds gets +1 played; winnerIds get +1 won.
export function record(gameId, playerIds = [], winnerIds = []) {
  const data = get(gameId)
  const winners = new Set(winnerIds)
  for (const id of playerIds) {
    if (!id) continue
    const e = data[id] || { played: 0, won: 0 }
    e.played += 1
    if (winners.has(id)) e.won += 1
    data[id] = e
  }
  storage.set(keyFor(gameId), data)
  return data
}

export function reset(gameId) {
  storage.set(keyFor(gameId), {})
}
