// Battaglia navale — the computer, as an admiral.
//
// It plays the same match a person does and knows nothing more: it is handed
// its own view (game.viewFor) and answers with a square. No peeking at the
// other fleet, at any level — what changes from one to the next is how much
// it makes of what it has seen.
//
//   easy:    fires at random, and only half the time remembers that the
//            square it just hit has a ship going on next to it
//   medium:  hunts on a chessboard (no ship fits between two squares of the
//            same colour) and, on a hit, follows the ship to its end
//   hard:    for every square, counts how many ways the ships still afloat
//            could lie across it given everything seen so far, and fires
//            where the count is highest
//
// Nothing is remembered between one shot and the next: the sea says it all.
import { SIZE, FLEET, key, cells } from './engine.js'

export const LEVELS = ['easy', 'medium', 'hard']

const inside = (r, c) => r >= 0 && c >= 0 && r < SIZE && c < SIZE
const SIDES = [[-1, 0], [1, 0], [0, -1], [0, 1]]
const pick = (list, rnd) => list[Math.floor(rnd() * list.length)]

// Everything the view says about the other sea, in a shape that is quick to ask.
function read(view) {
  const shot = new Map(view.outgoing.map(s => [key(s.r, s.c), s.hit]))
  const wreck = new Set()
  const calm = new Set() // the water round a wreck: ships never touch
  for (const s of view.foeShips) {
    for (const [r, c] of cells(s)) {
      wreck.add(key(r, c))
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) if (inside(r + dr, c + dc)) calm.add(key(r + dr, c + dc))
      }
    }
  }
  // hits on a ship that is still afloat: there is more of it nearby
  const open = view.outgoing.filter(s => s.hit && !wreck.has(key(s.r, s.c)))
  const afloat = [...FLEET]
  for (const s of view.foeShips) {
    const i = afloat.indexOf(s.len)
    if (i >= 0) afloat.splice(i, 1)
  }
  const free = (r, c) => inside(r, c) && !shot.has(key(r, c)) && !calm.has(key(r, c))
  const all = []
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (free(r, c)) all.push({ r, c })
  return { shot, wreck, calm, open, afloat, free, all }
}

// The squares next to a hit where the ship could go on.
function beside(k, hits) {
  const out = []
  for (const h of hits) {
    for (const [dr, dc] of SIDES) {
      const r = h.r + dr, c = h.c + dc
      if (k.free(r, c) && !out.some(o => o.r === r && o.c === c)) out.push({ r, c })
    }
  }
  return out
}

// One wounded ship: the open hits that lie in a row with the first of them.
function wounded(k) {
  const first = k.open[0]
  const group = [first]
  let grown = true
  while (grown) {
    grown = false
    for (const h of k.open) {
      if (group.includes(h)) continue
      if (group.some(g => Math.abs(g.r - h.r) + Math.abs(g.c - h.c) === 1)) { group.push(h); grown = true }
    }
  }
  return group
}

function easy(k, rnd) {
  if (k.open.length && rnd() < 0.5) {
    const near = beside(k, k.open)
    if (near.length) return pick(near, rnd)
  }
  return pick(k.all, rnd)
}

function medium(k, rnd) {
  if (k.open.length) {
    const ship = wounded(k)
    if (ship.length > 1) {
      // two hits give the direction away: only the two ends are worth a shot
      const across = ship[0].r === ship[1].r
      const line = ship.map(h => (across ? h.c : h.r))
      const lo = Math.min(...line), hi = Math.max(...line)
      const ends = (across
        ? [{ r: ship[0].r, c: lo - 1 }, { r: ship[0].r, c: hi + 1 }]
        : [{ r: lo - 1, c: ship[0].c }, { r: hi + 1, c: ship[0].c }]
      ).filter(e => k.free(e.r, e.c))
      if (ends.length) return pick(ends, rnd)
    }
    const near = beside(k, ship)
    if (near.length) return pick(near, rnd)
  }
  const board = k.all.filter(s => (s.r + s.c) % 2 === 0)
  return pick(board.length ? board : k.all, rnd)
}

function hard(k, rnd) {
  const hit = new Set(k.open.map(h => key(h.r, h.c)))
  const weight = new Float64Array(SIZE * SIZE)
  const count = mustTouch => {
    weight.fill(0)
    for (const len of k.afloat) {
      for (const dir of ['h', 'v']) {
        const maxR = dir === 'v' ? SIZE - len : SIZE - 1
        const maxC = dir === 'h' ? SIZE - len : SIZE - 1
        for (let r = 0; r <= maxR; r++) {
          for (let c = 0; c <= maxC; c++) {
            const own = cells({ r, c, len, dir })
            const keys = own.map(([a, b]) => key(a, b))
            let on = 0
            let ok = true
            for (const q of keys) {
              if (hit.has(q)) on++
              else if (k.shot.has(q) || k.calm.has(q)) { ok = false; break }
            }
            if (!ok || (mustTouch && !on)) continue
            // a hit this ship would lie against without covering it belongs
            // to another ship — and two ships never touch
            for (const [a, b] of own) {
              for (let dr = -1; dr <= 1 && ok; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                  const q = key(a + dr, b + dc)
                  if (inside(a + dr, b + dc) && hit.has(q) && !keys.includes(q)) { ok = false; break }
                }
              }
              if (!ok) break
            }
            if (!ok) continue
            // the more of the hits it explains, the likelier it is the one
            const w = Math.pow(12, on)
            for (const q of keys) if (!hit.has(q)) weight[q] += w
          }
        }
      }
    }
    let best = 0
    for (const s of k.all) best = Math.max(best, weight[key(s.r, s.c)])
    return best > 0 ? k.all.filter(s => weight[key(s.r, s.c)] === best) : []
  }
  const top = count(hit.size > 0)
  if (top.length) return pick(top, rnd)
  const any = hit.size ? count(false) : []
  return any.length ? pick(any, rnd) : medium(k, rnd)
}

const PLAY = { easy, medium, hard }

// The square to fire at, for the admiral this view belongs to.
//   -> { r, c }, or null if there is nowhere left to fire
export function pickShot(view, level = 'medium', rnd = Math.random) {
  const k = read(view)
  if (!k.all.length) return null
  return (PLAY[level] || medium)(k, rnd)
}
