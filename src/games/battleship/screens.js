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
import { SIZE, FLEET, key, cells, clashes, clamp, randomFleet, around, label } from './engine.js'

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
//   clash:   Set of square keys where ships lie on or against each other
//            (laying out the fleet): ringed in red
//   onTap(r, c)  makes every square a button; canTap(r, c) narrows it
export function sea({ ships = [], shots = [], sunk = [], last = null, clash = null, onTap = null, canTap = null, small = false } = {}) {
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
      if (clash && clash.has(k)) cls.push('clash')
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
// to play, and the ones who care move what they don't like.
//
// A ship is dragged where you want it: it lifts off the sea under your
// finger — a little bigger, a little see-through, with a shadow — and the
// squares it would land on light up underneath. A tap, without dragging,
// turns it round its bow. Ships may be left on top of or against each other
// while you work; the squares where they clash are ringed in red, and the
// fleet can't sail until there are none.
//   onReady(ships)
//   -> { node } — kept across redraws, so a message from the room arriving
//      while you're arranging doesn't throw your arrangement away
const TAP = 8 // px: a finger that moved less than this tapped, it didn't drag

export function createPlacer({ onReady }) {
  let ships = randomFleet()
  let sent = false
  let drag = null
  const node = el('div', { class: 'bs-place' })

  const shipOn = (r, c) => ships.findIndex(s => cells(s).some(([sr, sc]) => sr === r && sc === c))

  // The grid's own measures, read off the page: where a square starts and
  // how far apart two of them are.
  function metrics(grid) {
    const rect = grid.getBoundingClientRect()
    const cs = getComputedStyle(grid)
    const pad = parseFloat(cs.paddingLeft) || 0
    const gap = parseFloat(cs.columnGap) || 0
    const step = (rect.width - 2 * pad + gap) / SIZE
    return { rect, pad, gap, step }
  }

  function turn(i) {
    const s = ships[i]
    ships[i] = clamp({ ...s, dir: s.dir === 'h' ? 'v' : 'h' })
    paint()
  }

  function down(e, grid) {
    if (sent || drag) return
    const m = metrics(grid)
    const c = Math.floor((e.clientX - m.rect.left - m.pad) / m.step)
    const r = Math.floor((e.clientY - m.rect.top - m.pad) / m.step)
    const i = shipOn(r, c)
    if (i < 0) return
    e.preventDefault()
    grid.setPointerCapture(e.pointerId)
    const s = ships[i]
    drag = {
      i, grid, m, id: e.pointerId, moved: false,
      x0: e.clientX, y0: e.clientY,
      // where on the ship the finger took hold, so it stays under the finger
      dx: e.clientX - (m.rect.left + m.pad + s.c * m.step),
      dy: e.clientY - (m.rect.top + m.pad + s.r * m.step),
      ghost: null, at: null
    }
  }

  function move(e) {
    if (!drag || e.pointerId !== drag.id) return
    const { m, grid } = drag
    if (!drag.moved) {
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < TAP) return
      drag.moved = true
      lift()
    }
    // the ship's top-left corner, in the grid's own coordinates
    const x = e.clientX - drag.dx - m.rect.left
    const y = e.clientY - drag.dy - m.rect.top
    drag.ghost.style.transform = `translate(${x}px, ${y}px)`
    const at = clamp({
      ...ships[drag.i],
      r: Math.round((y - m.pad) / m.step),
      c: Math.round((x - m.pad) / m.step)
    })
    if (drag.at && drag.at.r === at.r && drag.at.c === at.c) return
    drag.at = at
    preview(grid, at)
  }

  function up(e) {
    if (!drag || e.pointerId !== drag.id) return
    const d = drag
    drag = null
    if (!d.moved) { turn(d.i); return }
    if (d.at) ships[d.i] = d.at
    paint()
  }

  // The ship comes off the sea: a copy of it under the finger, and the
  // squares it left behind go quiet.
  function lift() {
    const { i, grid, m } = drag
    const s = ships[i]
    const size = n => n * m.step - m.gap
    const ghost = el('div', {
      class: 'bs-ghost',
      style: `width:${size(s.dir === 'h' ? s.len : 1)}px;height:${size(s.dir === 'v' ? s.len : 1)}px;` +
        `grid-template-${s.dir === 'h' ? 'columns' : 'rows'}:repeat(${s.len}, 1fr);gap:${m.gap}px`
    }, Array.from({ length: s.len }, () => el('span', { class: 'bs-cell ship' })))
    grid.append(ghost)
    drag.ghost = ghost
    for (const [r, c] of cells(s)) grid.children[key(r, c)].classList.add('lifted')
    grid.classList.add('dragging')
  }

  // Where it would land if you let go now — and whether it would clash there.
  function preview(grid, at) {
    const rest = ships.map((s, j) => (j === drag.i ? at : s))
    const bad = clashes(rest)
    for (let k = 0; k < SIZE * SIZE; k++) grid.children[k].classList.remove('drop', 'drop-bad')
    for (const [r, c] of cells(at)) {
      const k = key(r, c)
      grid.children[k].classList.add(bad.has(k) ? 'drop-bad' : 'drop')
    }
  }

  function paint() {
    const clash = clashes(ships)
    const hint = sent ? t('bs.place.sent') : clash.size ? t('bs.place.clash') : t('bs.place.hint')
    const grid = sea({ ships, clash: sent ? null : clash })
    if (!sent) {
      grid.classList.add('arrange')
      grid.addEventListener('pointerdown', e => down(e, grid))
      grid.addEventListener('pointermove', move)
      grid.addEventListener('pointerup', up)
      grid.addEventListener('pointercancel', () => { drag = null; paint() })
    }
    node.replaceChildren(
      el('p', { class: 'drawer-hint bs-hint' + (clash.size && !sent ? ' bad' : '') }, hint),
      grid,
      sent ? null : el('div', { class: 'row' }, [
        button(t('bs.place.shuffle'), { variant: 'secondary', onClick: () => { ships = randomFleet(); paint() } }),
        button(t('bs.place.ready'), {
          variant: 'primary', disabled: clash.size > 0,
          onClick: () => {
            if (clashes(ships).size) return
            sent = true
            paint()
            onReady(ships.map(s => ({ ...s })))
          }
        })
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
