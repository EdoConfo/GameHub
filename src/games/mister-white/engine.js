// Mister White — pure game logic. No DOM here.
//
// Roles:
//   'civile'     -> knows the civilian (secret) word
//   'undercover' -> knows a similar-but-different word
//   'mrwhite'    -> knows no word
// Civili are the good guys; undercover + mrwhite are the "impostori".
import { shuffle } from '../../shared/ui.js'

export const ROLE = { CIVILE: 'civile', UNDERCOVER: 'undercover', MRWHITE: 'mrwhite' }

// Suggested role counts for a player count.
export function suggestCounts(numPlayers) {
  const mrwhite = 1
  const undercover = numPlayers >= 5 ? 1 : 0
  return { mrwhite, undercover }
}

// Validate a setup. Returns { ok:true } or { ok:false, message }.
export function validateSetup(numPlayers, counts) {
  if (numPlayers < 3) return { ok: false, message: 'Servono almeno 3 giocatori.' }
  if (numPlayers > 20) return { ok: false, message: 'Massimo 20 giocatori.' }
  const impostori = counts.mrwhite + counts.undercover
  if (impostori < 1) return { ok: false, message: 'Serve almeno un impostore (Mister White o Undercover).' }
  // Keep at least 2 civili so the game is playable.
  if (numPlayers - impostori < 2) {
    return { ok: false, message: 'Troppi impostori: lascia almeno 2 civili.' }
  }
  return { ok: true }
}

// Build a round: assign roles + words. Returns { players, pair, order }.
// names: string[]; pair: { civilian, undercover }; counts: { mrwhite, undercover }
export function buildRound(names, pair, counts) {
  const roles = []
  for (let i = 0; i < counts.mrwhite; i++) roles.push(ROLE.MRWHITE)
  for (let i = 0; i < counts.undercover; i++) roles.push(ROLE.UNDERCOVER)
  while (roles.length < names.length) roles.push(ROLE.CIVILE)

  const shuffledRoles = shuffle(roles)
  const players = names.map((name, i) => {
    const role = shuffledRoles[i]
    let word = ''
    if (role === ROLE.CIVILE) word = pair.civilian
    else if (role === ROLE.UNDERCOVER) word = pair.undercover
    return { id: i, name, role, word, alive: true }
  })

  // Turn order: seating order (as entered), random starting player.
  const start = Math.floor(Math.random() * players.length)
  const order = players.map((_, i) => (start + i) % players.length)

  return { players, pair, order }
}

// Winner check based on who is still alive. Returns null | 'civili' | 'impostori'.
export function checkWinner(players) {
  const civili = players.filter(p => p.alive && p.role === ROLE.CIVILE).length
  const impostori = players.filter(p => p.alive && p.role !== ROLE.CIVILE).length
  if (impostori === 0) return 'civili'
  if (impostori >= civili) return 'impostori'
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
