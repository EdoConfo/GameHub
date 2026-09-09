// Per-game stats + match history, keyed by player profile id. Shared store.
//   stats:<gameId>  = { [profileId]: { played, won } }   (aggregate)
//   hist:<gameId>   = [ { ts, players:[ids], winners:[ids], result } ]  (recent first)
import * as storage from './storage.js'

const HISTORY_CAP = 60

function aggKey(gameId) { return 'stats:' + gameId }
function histKey(gameId) { return 'hist:' + gameId }

export function get(gameId) {
  const data = storage.get(aggKey(gameId), {})
  return data && typeof data === 'object' ? data : {}
}

export function history(gameId) {
  const h = storage.get(histKey(gameId), [])
  return Array.isArray(h) ? h : []
}

// Record one match. meta may carry { result } (short outcome label).
export function record(gameId, playerIds = [], winnerIds = [], meta = {}) {
  const players = playerIds.filter(Boolean)
  const winners = winnerIds.filter(Boolean)

  // aggregate
  const data = get(gameId)
  const wonSet = new Set(winners)
  for (const id of players) {
    const e = data[id] || { played: 0, won: 0 }
    e.played += 1
    if (wonSet.has(id)) e.won += 1
    data[id] = e
  }
  storage.set(aggKey(gameId), data)

  // history (most recent first, capped)
  const h = history(gameId)
  h.unshift({ ts: Date.now(), players, winners, result: meta.result || '' })
  storage.set(histKey(gameId), h.slice(0, HISTORY_CAP))
  return data
}

// Aggregate summary for one player across the given games.
// Returns { total:{played,won}, perGame: { [gameId]: {played,won} } }
export function summary(gameIds, playerId) {
  const perGame = {}
  const total = { played: 0, won: 0 }
  for (const gameId of gameIds) {
    const e = get(gameId)[playerId]
    if (e) {
      perGame[gameId] = e
      total.played += e.played
      total.won += e.won
    }
  }
  return { total, perGame }
}

// Merged recent matches for one player across the given games (recent first).
export function feed(gameIds, playerId, limit = 30) {
  const items = []
  for (const gameId of gameIds) {
    for (const m of history(gameId)) {
      if (m.players.includes(playerId)) {
        items.push({ gameId, ts: m.ts, won: m.winners.includes(playerId), result: m.result })
      }
    }
  }
  items.sort((a, b) => b.ts - a.ts)
  return items.slice(0, limit)
}

export function reset(gameId) {
  storage.set(aggKey(gameId), {})
  storage.set(histKey(gameId), [])
}
