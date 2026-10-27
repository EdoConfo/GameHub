// Battaglia navale — the rules, and nothing else.
//
// A sea is SIZE × SIZE squares. A ship is where its bow is, which way it
// points and how long it is: { r, c, len, dir: 'h' | 'v' }. Everything else —
// the squares it covers, whether it is sunk — is worked out from that and the
// shots, never stored twice.
//
// No DOM and no players here: game.js keeps a match with these, screens.js
// draws them.

export const SIZE = 10

// The classic fleet: a carrier, a battleship, two cruisers and a destroyer.
// Seventeen squares out of a hundred — a sea mostly of water, which is what
// makes it a guessing game and not a counting one.
export const FLEET = [5, 4, 3, 3, 2]

export const key = (r, c) => r * SIZE + c

export function cells(ship) {
  const out = []
  for (let i = 0; i < ship.len; i++) {
    out.push(ship.dir === 'h' ? [ship.r, ship.c + i] : [ship.r + i, ship.c])
  }
  return out
}

const inside = (r, c) => r >= 0 && c >= 0 && r < SIZE && c < SIZE

// Ships never touch, not even at a corner: a hit always tells you the ship
// goes on in one of four directions, never "or maybe it's the one next door".
// It is the way it is played on paper in Italy, and it keeps the sea readable.
function halo(ship) {
  const out = new Set()
  for (const [r, c] of cells(ship)) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (inside(r + dr, c + dc)) out.add(key(r + dr, c + dc))
      }
    }
  }
  return out
}

// Can `ship` go where it says, next to `others`?
export function fits(ship, others = []) {
  if (!cells(ship).every(([r, c]) => inside(r, c))) return false
  const own = new Set(cells(ship).map(([r, c]) => key(r, c)))
  for (const o of others) {
    for (const k of halo(o)) if (own.has(k)) return false
  }
  return true
}

// A whole fleet, as a player hands it in: the right ships, all at sea, none
// touching. What a phone sends is checked here and not trusted.
export function validFleet(ships) {
  if (!Array.isArray(ships) || ships.length !== FLEET.length) return false
  const lens = ships.map(s => s && s.len).sort((a, b) => b - a)
  if (lens.some((l, i) => l !== FLEET[i])) return false
  return ships.every((s, i) =>
    (s.dir === 'h' || s.dir === 'v') &&
    Number.isInteger(s.r) && Number.isInteger(s.c) &&
    fits(s, ships.filter((_, j) => j !== i)))
}

// Cleaned up for keeping: only the four numbers a ship is.
export const tidy = ships => ships.map(({ r, c, len, dir }) => ({ r, c, len, dir }))

// A fleet thrown at sea at random. Biggest first, because the last little
// boat always finds a hole and the carrier doesn't; and the whole fleet is
// thrown again in the very unlikely case it paints itself into a corner.
export function randomFleet() {
  for (;;) {
    const ships = []
    let stuck = false
    for (const len of FLEET) {
      let placed = false
      for (let tries = 0; tries < 300 && !placed; tries++) {
        const dir = Math.random() < 0.5 ? 'h' : 'v'
        const r = Math.floor(Math.random() * (dir === 'v' ? SIZE - len + 1 : SIZE))
        const c = Math.floor(Math.random() * (dir === 'h' ? SIZE - len + 1 : SIZE))
        const ship = { r, c, len, dir }
        if (fits(ship, ships)) { ships.push(ship); placed = true }
      }
      if (!placed) { stuck = true; break }
    }
    if (!stuck) return ships
  }
}

// Which ship sits on (r, c), by index — or -1 for water.
export function shipAt(ships, r, c) {
  return ships.findIndex(s => cells(s).some(([sr, sc]) => sr === r && sc === c))
}

// shots: [{ r, c }] fired at this fleet
export function isSunk(ship, shots) {
  const hit = new Set(shots.map(s => key(s.r, s.c)))
  return cells(ship).every(([r, c]) => hit.has(key(r, c)))
}

export const allSunk = (ships, shots) => ships.every(s => isSunk(s, shots))

// The water round a sunk ship: no ship can be there (they never touch), so
// the sea marks it for you instead of letting you waste a shot on it.
export function around(ship) {
  const own = new Set(cells(ship).map(([r, c]) => key(r, c)))
  return [...halo(ship)].filter(k => !own.has(k)).map(k => [Math.floor(k / SIZE), k % SIZE])
}

// Square names as they are said across a table: a letter for the row, a
// number for the column — "B7".
export const label = (r, c) => String.fromCharCode(65 + r) + (c + 1)
