// Mister White — pure game logic. No DOM here.
//
// Roles:
//   'civile'     -> knows the civilian (secret) word
//   'undercover' -> knows a similar-but-different word
//   'mrwhite'    -> knows no word
// Civili are the good guys; undercover + mrwhite are the "impostori".
import { shuffle } from '../../shared/ui.js'

export const ROLE = { CIVILE: 'civile', UNDERCOVER: 'undercover', MRWHITE: 'mrwhite' }

// The most impostors a table of n can have: the civilians start in the
// majority, as in the original game — 3–4 players -> 1, 5–6 -> 2, 7–8 -> 3, …
export function maxImpostors(n) { return Math.max(0, Math.floor((n - 1) / 2)) }

// Suggested counts: about 4 impostors in 10, one Mister White (two from 11
// players), the rest Undercover.
export function suggestCounts(n) {
  const imp = Math.max(1, Math.min(maxImpostors(n), Math.round(n * 0.4)))
  const mrwhite = Math.min(imp, n >= 11 ? 2 : 1)
  return { mrwhite, undercover: imp - mrwhite }
}

// Keep chosen counts, trimmed to what n players allow (Undercover go first).
export function fitCounts(n, { mrwhite, undercover }) {
  const max = Math.max(1, maxImpostors(n))
  while (mrwhite + undercover > max && undercover > 0) undercover--
  while (mrwhite + undercover > max && mrwhite > 0) mrwhite--
  if (mrwhite + undercover < 1) mrwhite = 1
  return { mrwhite, undercover }
}

// Validate a setup. Returns { ok:true } or { ok:false, message }.
export function validateSetup(n, counts) {
  if (n < 3) return { ok: false, message: 'Servono almeno 3 giocatori.' }
  if (n > 20) return { ok: false, message: 'Massimo 20 giocatori.' }
  const impostori = counts.mrwhite + counts.undercover
  if (impostori < 1) return { ok: false, message: 'Serve almeno un impostore.' }
  if (impostori > maxImpostors(n)) return { ok: false, message: 'Troppi impostori: i civili devono essere di più.' }
  return { ok: true }
}

// Build a round: assign roles + words. Returns { players, pair, order }.
// people: array of { name, pid, seat } in table order (pid = shared player
// profile id, null for an empty chair; seat = table seat id).
// pair: { civilian, undercover }; counts: { mrwhite, undercover }
export function buildRound(people, pair, counts) {
  const list = people.map(p => (typeof p === 'string' ? { name: p, pid: null } : p))
  const roles = []
  for (let i = 0; i < counts.mrwhite; i++) roles.push(ROLE.MRWHITE)
  for (let i = 0; i < counts.undercover; i++) roles.push(ROLE.UNDERCOVER)
  while (roles.length < list.length) roles.push(ROLE.CIVILE)

  const shuffledRoles = shuffle(roles)
  const players = list.map((person, i) => {
    const role = shuffledRoles[i]
    let word = ''
    if (role === ROLE.CIVILE) word = pair.civilian
    else if (role === ROLE.UNDERCOVER) word = pair.undercover
    return { id: i, name: person.name, pid: person.pid || null, seat: person.seat || null, role, word, alive: true }
  })

  // Clues go round the table from a random player — never a Mister White,
  // who has no word to start from.
  const can = players.filter(p => p.role !== ROLE.MRWHITE)
  const first = can[Math.floor(Math.random() * can.length)] || players[0]
  const order = players.map((_, i) => (first.id + i) % players.length)

  return { players, pair, order }
}

// The Goddess of Justice: a random player still in the game. When the vote
// ends in a tie, she decides who goes.
export function pickGoddess(players) {
  const alive = players.filter(p => p.alive)
  return alive.length ? alive[Math.floor(Math.random() * alive.length)] : null
}

// Winner check based on who is still alive. Returns null | 'civili' | 'impostori'.
// An Undercover doesn't even know they're one, so there's no majority to take
// over: as in the original game, the impostors win by lasting until a single
// civilian is left.
export function checkWinner(players) {
  const civili = players.filter(p => p.alive && p.role === ROLE.CIVILE).length
  const impostori = players.filter(p => p.alive && p.role !== ROLE.CIVILE).length
  if (impostori === 0) return 'civili'
  if (civili <= 1) return 'impostori'
  return null
}

// Does a Mister White guess match the civilian word? Loose compare.
export function guessMatches(guess, civilianWord) {
  const norm = s => String(s || '').trim().toLowerCase()
  return norm(guess) !== '' && norm(guess) === norm(civilianWord)
}

export function roleLabel(role) {
  if (role === ROLE.MRWHITE) return 'Mister White'
  if (role === ROLE.UNDERCOVER) return 'Undercover'
  return 'Civile'
}
