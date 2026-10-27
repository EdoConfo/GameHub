// Battaglia navale, drawn.
//
// The sea, the fleet being laid out, and the match as one admiral sees it —
// the same screens whether the other admiral is on another phone (room.js,
// guest.js) or on the other side of this one (local.js). Everything here
// draws what it is given and reports taps; the deciding is in game.js.
import { el, clear, icon, button } from '../../shared/ui.js'
import { t } from '../../shared/i18n.js'
import { avatar } from '../../hub/players.js'
import { keepAbove } from '../../shared/roomUi.js'
import { SIZE, FLEET, key, cells, fits, randomFleet, around, label } from './engine.js'

// ---------- the frame every screen sits in ----------
// A column under the game's header, like a phone that joined a Quiplash
// room: there is no table here, two people don't need one.
//   code:   the room's code, shown in the corner while there is a room
//   live:   is this phone actually in it?
export function frame(container, { onBack, code = '', live = true }, children) {
  if (container._stopViewport) { container._stopViewport(); container._stopViewport = null }
  clear(container)
  const bar = el('div', { class: 'hub-header' }, [
    el('button', { class: 'icon-btn', 'aria-label': t('common.back'), onclick: onBack }, icon('back')),
    el('span', { class: 'wordmark game-home-title' }, t('bs.name').toUpperCase()),
    code ? el('span', { class: 'room-code-tag' + (live ? '' : ' off') }, code) : null
  ])
  const node = el('div', { class: 'guest bs' }, [bar, el('div', { class: 'guest-body' }, children)])
  container.append(node)
  container._stopViewport = keepAbove(node)
}

export function unframe(container) {
  if (container._stopViewport) { container._stopViewport(); container._stopViewport = null }
}

export const head = (title, sub) => el('div', { class: 'guest-head' }, [
  el('div', { class: 'guest-title' }, title),
  sub ? el('p', { class: 'drawer-hint' }, sub) : null
])

// ---------- the sea ----------
// One grid of SIZE × SIZE squares, and what is known about each of them.
//   ships:   ships to draw whole (your own fleet, or the other one's wrecks)
//   shots:   [{ r, c, hit }] fired at this sea
//   sunk:    ships that are down — drawn as wrecks, with the water round them
//            marked, since nothing can be there
//   last:    { r, c } the square to ring: the shot everybody is reading
//   pick:    index of the ship picked up (laying out the fleet)
//   onTap(r, c)  makes every square a button; canTap(r, c) narrows it
export function sea({ ships = [], shots = [], sunk = [], last = null, pick = -1, onTap = null, canTap = null, small = false } = {}) {
  const ship = new Map()
  ships.forEach((s, i) => { for (const [r, c] of cells(s)) ship.set(key(r, c), i) })
  const shot = new Map(shots.map(s => [key(s.r, s.c), s]))
  const wreck = new Set()
  const calm = new Set()
  for (const s of sunk) {
    for (const [r, c] of cells(s)) wreck.add(key(r, c))
    for (const [r, c] of around(s)) calm.add(key(r, c))
  }

  const grid = el('div', { class: 'bs-sea' + (small ? ' small' : '') + (onTap ? ' live' : '') })
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const k = key(r, c)
      const s = shot.get(k)
      const cls = ['bs-cell']
      if (ship.has(k)) cls.push('ship')
      if (ship.has(k) && ship.get(k) === pick) cls.push('pick')
      if (wreck.has(k)) cls.push('sunk')
      else if (s && s.hit) cls.push('hit')
      else if (s) cls.push('miss')
      else if (calm.has(k)) cls.push('calm')
      if (last && last.r === r && last.c === c) cls.push('last')
      const tappable = onTap && (!canTap || canTap(r, c))
      grid.append(el(tappable ? 'button' : 'span', {
        class: cls.join(' '),
        'aria-label': label(r, c),
        onclick: tappable ? () => onTap(r, c) : null
      }))
    }
  }
  return grid
}

// ---------- laying out the fleet ----------
// The fleet starts at sea already, thrown at random: most people just want
// to play, and the ones who care move what they don't like. Tap a ship to
// pick it up, tap water to put it there (the bow goes where you tap), tap it
// again to turn it round.
//   onReady(ships)
//   -> { node } — kept across redraws, so a message from the room arriving
//      while you're arranging doesn't throw your arrangement away
export function createPlacer({ onReady }) {
  let ships = randomFleet()
  let pick = -1
  let sent = false
  const node = el('div', { class: 'bs-place' })

  const others = i => ships.filter((_, j) => j !== i)

  function tap(r, c) {
    if (sent) return
    const at = ships.findIndex(s => cells(s).some(([sr, sc]) => sr === r && sc === c))
    if (at >= 0) {
      if (at !== pick) { pick = at; paint(); return }
      // the same ship again: turn it round its bow, if it has room to
      const turned = { ...ships[at], dir: ships[at].dir === 'h' ? 'v' : 'h' }
      if (fits(turned, others(at))) ships[at] = turned
      else nudge()
      paint()
      return
    }
    if (pick < 0) return
    const moved = { ...ships[pick], r, c }
    if (fits(moved, others(pick))) ships[pick] = moved
    else nudge()
    paint()
  }

  // A move that can't be made says so with the board, not with words.
  function nudge() {
    node.classList.remove('nope')
    void node.offsetWidth
    node.classList.add('nope')
  }

  function paint() {
    const hint = sent ? t('bs.place.sent')
      : pick < 0 ? t('bs.place.hint') : t('bs.place.picked', { n: ships[pick].len })
    node.replaceChildren(
      el('p', { class: 'drawer-hint bs-hint' }, hint),
      sea({ ships, pick, onTap: sent ? null : tap }),
      sent ? null : el('div', { class: 'row' }, [
        button(t('bs.place.shuffle'), { variant: 'secondary', onClick: () => { ships = randomFleet(); pick = -1; paint() } }),
        button(t('bs.place.ready'), { variant: 'primary', onClick: () => { sent = true; pick = -1; paint(); onReady(ships.map(s => ({ ...s }))) } })
      ])
    )
  }

  paint()
  return {
    node,
    // the room didn't take it (it shouldn't happen): back to arranging
    reopen() { sent = false; paint() }
  }
}

// ---------- the match, as one admiral sees it ----------
const nameOf = (view, pid) => {
  const p = view.players.find(x => x.pid === pid)
  return p ? p.name : '?'
}

// What the last shot did, said from where this admiral sits.
export function lastLine(view) {
  const l = view.last
  if (!l) return ''
  const where = label(l.r, l.c)
  const what = l.sunk ? t('bs.shot.sunk', { n: l.sunk }) : l.hit ? t('bs.shot.hit') : t('bs.shot.miss')
  return l.by === view.me
    ? t('bs.shot.mine', { where, what })
    : t('bs.shot.theirs', { name: nameOf(view, l.by), where, what })
}

// The battle: their sea on top, big, to fire into; yours underneath, small,
// to see what they've done to it.
//   onFire(r, c) — only while it's this admiral's turn
//   after:  something to put under the seas (local.js's "pass the phone")
//   pending: { r, c } a shot sent and not yet answered (guest.js)
export function battle(view, { onFire, after = null, pending = null }) {
  const mine = view.turn === view.me && !pending
  const fired = new Set(view.outgoing.map(s => key(s.r, s.c)))
  const calm = new Set()
  for (const s of view.foeShips) for (const [r, c] of around(s)) calm.add(key(r, c))
  const lastAtThem = view.last && view.last.by === view.me ? view.last : null
  const lastAtMe = view.last && view.last.by !== view.me ? view.last : null
  const foe = nameOf(view, view.foe)

  const title = mine ? t('bs.battle.yourTurn')
    : view.turn === view.me ? t('bs.battle.firing')
      : t('bs.battle.theirTurn', { name: foe })

  return [
    head(title, lastLine(view) || (mine ? t('bs.battle.tapHint') : '')),
    el('div', { class: 'bs-label' }, [
      el('span', {}, t('bs.battle.theirSea', { name: foe })),
      el('b', {}, t('bs.battle.afloat', { n: view.foeAfloat ?? FLEET.length }))
    ]),
    sea({
      shots: view.outgoing,
      sunk: view.foeShips,
      // a shot on its way to the other phone is ringed where it will land
      last: pending || lastAtThem,
      onTap: mine ? onFire : null,
      canTap: (r, c) => !fired.has(key(r, c)) && !calm.has(key(r, c))
    }),
    el('div', { class: 'bs-own' }, [
      el('div', { class: 'bs-label' }, [
        el('span', {}, t('bs.battle.yourSea')),
        el('b', {}, t('bs.battle.afloat', { n: view.myAfloat ?? FLEET.length }))
      ]),
      sea({ ships: view.fleet || [], shots: view.incoming, last: lastAtMe, small: true })
    ]),
    after
  ]
}

// The end: who won, and both seas laid bare.
export function over(view, { actions = [] } = {}) {
  const won = view.winner === view.me
  return [
    head(won ? t('bs.over.won') : t('bs.over.lost', { name: nameOf(view, view.winner) }),
      won ? t('bs.over.wonSub', { n: view.outgoing.length }) : t('bs.over.lostSub')),
    el('div', { class: 'bs-label' }, [el('span', {}, t('bs.battle.theirSea', { name: nameOf(view, view.foe) }))]),
    sea({ ships: view.foeShips, shots: view.outgoing, sunk: view.foeShips.filter(s => cells(s).every(([r, c]) => view.outgoing.some(x => x.r === r && x.c === c))) }),
    el('div', { class: 'row stack' }, actions)
  ]
}

// Somebody's turn on a phone passed across the table: the screen shows no
// sea at all until the right person says they're holding it.
export function cover(player, { title, sub, onGo }) {
  return [
    el('div', { class: 'bs-cover' }, [
      avatar(player, 96),
      head(title, sub)
    ]),
    button(t('bs.local.itsMe', { name: player.name }), { variant: 'primary', full: true, onClick: onGo })
  ]
}
