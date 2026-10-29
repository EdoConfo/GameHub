// Battaglia navale across two phones: each admiral on their own, the sea
// in their hand and nobody leaning over it.
//
// One phone opens the room and holds the match (game.js) — it is the one
// that knows where both fleets are, so it can call every shot. The other
// joins with the code, hands in its fleet and asks to fire; it only ever
// gets told its own view (viewFor), never the other fleet.
//
// Unlike Quiplash, the phone that opens the room always plays: there are two
// admirals and two phones. Each phone still has the table, though — the
// game's circle become a table with two chairs — and the drawer under it.
//
// Everybody in the room receives every message, so a laptop with the console
// open could read the other side's view. It's a game among friends, not a
// bank — the same deal Quiplash makes (see shared/realtime.js).
import { el, button, walls } from '../../shared/ui.js'
import { t } from '../../shared/i18n.js'
import { faceGrid, newFaceCell, openProfileEditor } from '../../hub/players.js'
import { openRoom, newCode, cleanCode, CODE_LEN } from '../../shared/realtime.js'
import { codeField } from '../../shared/roomUi.js'
import { createGame } from './game.js'
import { page, head, admirals, sea, createPlacer, battle, over } from './screens.js'

const GAME = 'battleship'
const CODE_KEY = 'battleship:room'
const ME_KEY = 'battleship:me'
const BEAT = 2500   // how often the room repeats itself, for whoever missed it
const KNOCK = 2000  // how often a guest says hello until the room answers

// ---------- who am I ----------
// Both sides start the same way: pick the face you play as. The last one
// picked on this phone is already picked.
function whoPage(ctx, { me, title, hint, extra = [], go, onPick }) {
  const all = ctx.players.all()
  const grid = faceGrid(all, p => onPick(p),
    newFaceCell(t('common.new'), () => openProfileEditor(ctx, null, p => { if (p) onPick(p) })))
  const at = me ? all.findIndex(p => p.id === me.id) : -1
  if (at >= 0 && grid.children[at]) grid.children[at].classList.add('on')
  return page([
    head(title, hint),
    ...extra,
    el('span', { class: 'field-label' }, t('bs.room.who')),
    walls(el('div', { class: 'list-scroll' }, grid)),
    go
  ])
}

const savedMe = ctx => {
  const id = ctx.storage.get(ME_KEY, null)
  return ctx.players.all().find(p => p.id === id) || null
}

const face = p => ({ pid: p.id, name: p.name, color: p.color, emoji: p.emoji })

// Me at the bottom, facing my phone; the other admiral across the table.
const chairs = (view, me) => {
  const mine = view.players.find(p => p.pid === me)
  return [mine, ...view.players.filter(p => p.pid !== me)].filter(Boolean)
}

// The match itself, from one admiral's view — the same on both phones: the
// table with the two chairs, the drawer with the sea.
//   view:    what game.viewFor said for this admiral
//   placer:  the fleet being laid out (kept by the caller across redraws)
//   pending: a shot sent and not answered yet
//   note:    a line of news to put on top (the other one has left)
function showMatch(stage, view, { placer, pending, onFire, actions, note = null }) {
  const foe = view.players.find(p => p.pid === view.foe)
  const seated = chairs(view, view.me)
  const news = note ? el('p', { class: 'drawer-hint room-off' }, note) : null
  if (view.phase === 'place') {
    const placed = view.players.filter(p => view.placed[p.pid]).map(p => p.pid)
    if (!view.placed[view.me] && placer) {
      stage.view.set(admirals(seated, { names: false, dim: placed }))
      stage.present(page([head(t('bs.place.titleMine'), ''), news, placer.node], { tall: true }), { key: 'place' })
      return
    }
    stage.view.set(admirals(seated, { dim: placed.filter(pid => pid !== view.me), lit: view.me }))
    stage.present(page([
      head(t('bs.room.waitFleet', { name: foe ? foe.name : '?' }), t('bs.room.waitFleetSub')),
      news,
      sea({ ships: view.fleet || [], small: true })
    ]), { key: 'wait-fleet' })
    return
  }
  if (view.phase === 'battle') {
    stage.view.set(admirals(seated, { lit: view.turn, names: false }))
    const children = battle(view, { onFire, pending })
    if (news) children.splice(1, 0, news)
    stage.present(page(children, { tall: true }), { key: 'battle' })
    return
  }
  stage.view.set(admirals(seated, { lit: view.winner, dim: seated.map(p => p.pid).filter(pid => pid !== view.winner) }))
  const children = over(view, { actions })
  if (news) children.splice(1, 0, news)
  stage.present(page(children, { tall: true }), { key: 'over' })
}

// =====================================================================
// The phone that opens the room.
// =====================================================================
export function placeRoom(scene, ctx) {
  const { stage } = scene
  let me = savedMe(ctx)
  let code = ''
  let wire = null
  let status = 'wait'
  let beat = 0
  let placer = null
  let recorded = false
  let gone = null // the other admiral left mid-match: their name
  let left = false

  const game = createGame({ onChange: () => { publish(); render() } })

  const guest = () => game.state.players.find(p => p.pid !== (me && me.id)) || null

  // What the other phone may see: its own view, and nothing else.
  function publish() {
    if (!wire) return
    const g = guest()
    if (g) wire.send('view', { to: g.pid, view: game.viewFor(g.pid) })
    else wire.send('open', { code })
  }

  function open() {
    if (!me) return
    ctx.storage.set(ME_KEY, me.id)
    code = newCode()
    game.join(face(me))
    wire = openRoom(code, {
      game: GAME,
      onStatus: s => { status = s; render() },
      onMessage: (event, msg) => {
        if (!msg || typeof msg !== 'object') return
        if (event === 'hello') {
          // Somebody new while there's already somebody: the room is full,
          // and they're told so instead of knocking forever.
          if (!game.join({ pid: msg.pid, name: msg.name, color: msg.color, emoji: msg.emoji })) {
            wire.send('full', { to: msg.pid })
            return
          }
          gone = null
          // A whole room as soon as there are two of us: there is nothing
          // left to wait for, so the fleets go out straight away.
          if (game.state.phase === 'lobby' && game.ready()) game.begin()
          publish()
          return
        }
        if (event === 'bye') {
          const g = guest()
          if (!g || g.pid !== msg.pid) return
          if (game.state.phase === 'lobby') game.leave(msg.pid)
          else if (game.state.phase !== 'over') { gone = g.name; render() }
          return
        }
        if (event === 'fleet') { if (!game.place(msg.pid, msg.ships)) publish(); return }
        if (event === 'fire') { if (!game.fire(msg.pid, msg.r, msg.c)) publish(); return }
        if (event === 'again') { game.again(); return }
      }
    })
    beat = setInterval(publish, BEAT)
    render()
  }

  function record() {
    if (recorded || game.state.phase !== 'over') return
    recorded = true
    const known = id => ctx.players.get(id)
    const ids = game.state.players.map(p => p.pid).filter(known)
    const winner = game.state.players.find(p => p.pid === game.state.winner)
    if (ids.length) {
      ctx.stats.record('battleship', ids, [game.state.winner].filter(known), {
        result: t('bs.over.result', { name: winner.name })
      })
    }
  }

  function render() {
    if (left) return
    scene.header({ code: wire ? code : '', live: status === 'on' })
    if (!wire) {
      stage.view.set(admirals(me ? [face(me)] : []))
      stage.view.setCenter(null)
      stage.present(whoPage(ctx, {
        me,
        title: t('bs.room.openTitle'),
        hint: t('bs.room.openHint'),
        onPick: p => { me = p; render() },
        go: button(t('bs.room.open'), { variant: 'primary', full: true, disabled: !me, onClick: open })
      }), { key: 'who' })
      return
    }
    const phase = game.state.phase
    if (phase === 'lobby') {
      // my chair, and an empty one across the table for whoever types the code
      stage.view.set(admirals([face(me)], { lit: me.id }))
      stage.present(page([
        el('div', { class: 'room-code' }, [
          el('span', { class: 'room-code-label' }, t('ql.room.codeLabel')),
          el('b', {}, code)
        ]),
        el('p', { class: 'drawer-hint' + (status === 'off' ? ' room-off' : '') },
          t(status === 'on' ? 'bs.room.codeHint' : status === 'off' ? 'bs.room.offline' : 'ql.room.opening')),
        el('div', { class: 'guest-wait' }, t('bs.room.waiting'))
      ]), { key: 'lobby' })
      return
    }
    if (phase === 'place' && !game.placed(me.id) && !placer) {
      placer = createPlacer({ onReady: ships => { if (!game.place(me.id, ships)) placer.reopen() } })
    }
    if (phase !== 'place') placer = null
    if (phase === 'over') record()
    else recorded = false

    showMatch(stage, game.viewFor(me.id), {
      placer,
      onFire: (r, c) => game.fire(me.id, r, c),
      note: gone ? t('bs.room.gone', { name: gone }) : null,
      actions: [
        button(t('bs.over.again'), { variant: 'primary', full: true, onClick: () => game.again() }),
        button(t('bs.room.close'), { variant: 'secondary', full: true, onClick: () => scene.exit() })
      ]
    })
  }

  render()

  return () => {
    left = true
    clearInterval(beat)
    if (wire) { wire.send('closed', { code }); wire.leave() }
  }
}

// =====================================================================
// The phone that joins it.
// =====================================================================
export function placeGuest(scene, ctx) {
  const { stage } = scene
  let me = savedMe(ctx)
  let code = cleanCode(ctx.storage.get(CODE_KEY, '') || '')
  let wire = null
  let view = null
  let status = 'wait'
  let closed = false
  let full = false
  let knock = 0
  let placer = null
  let fleet = null    // handed in, not yet confirmed: said again until it is
  let shot = null     // fired, not yet answered: { r, c }
  let recorded = false
  let left = false

  const myPid = () => (me ? me.id : null)

  function hello() {
    if (wire && me) wire.send('hello', face(me))
  }

  function connect() {
    ctx.storage.set(CODE_KEY, code)
    ctx.storage.set(ME_KEY, me.id)
    wire = openRoom(code, {
      game: GAME,
      onStatus: s => { status = s; render() },
      onMessage: (event, msg) => {
        if (!msg || typeof msg !== 'object') return
        if (event === 'view' && msg.to === myPid()) { onView(msg.view); return }
        if (event === 'full' && msg.to === myPid()) { full = true; render(); return }
        if (event === 'closed') { closed = true; render() }
      }
    })
    hello()
    // Until the room has us in it, we keep saying hello: it may have been
    // opened a second after we knocked.
    knock = setInterval(() => { if (!view && !full) hello() }, KNOCK)
    render()
  }

  function onView(next) {
    if (!next || (view && next.v < view.v)) return
    const same = view && next.v === view.v
    view = next
    closed = false
    // Anything we said that the room hasn't taken in yet, we say again.
    if (fleet) {
      if (view.phase !== 'place' || view.placed[myPid()]) fleet = null
      else wire.send('fleet', { pid: myPid(), ships: fleet })
    }
    if (shot) {
      const landed = view.outgoing.some(s => s.r === shot.r && s.c === shot.c)
      if (landed || view.phase !== 'battle' || view.turn !== myPid()) shot = null
      else wire.send('fire', { pid: myPid(), r: shot.r, c: shot.c })
    }
    if (view.phase !== 'place') placer = null
    if (same && !fleet && !shot) return // the beat, with nothing new on it
    render()
  }

  function record() {
    if (recorded) return
    recorded = true
    const known = id => ctx.players.get(id)
    const ids = view.players.map(p => p.pid).filter(known)
    const winner = view.players.find(p => p.pid === view.winner)
    if (ids.length) {
      ctx.stats.record('battleship', ids, [view.winner].filter(known), {
        result: t('bs.over.result', { name: winner ? winner.name : '?' })
      })
    }
  }

  // A short page with one way out: the room is closed, full, or still being
  // knocked on.
  function notice(key, title, sub, way) {
    stage.view.set(admirals(me ? [face(me)] : []))
    stage.present(page([head(title, sub), way]), { key })
  }

  function render() {
    if (left) return
    scene.header({ code: wire ? code : '', live: status === 'on' })
    if (!wire) {
      const ready = () => code.length === CODE_LEN && !!me
      const go = button(t('bs.join.enter'), {
        variant: 'primary', full: true, disabled: !ready(),
        onClick: () => { if (ready()) connect() }
      })
      stage.view.set(admirals(me ? [face(me)] : []))
      stage.view.setCenter(null)
      stage.present(whoPage(ctx, {
        me,
        title: t('bs.join.title'),
        hint: t('bs.join.hint'),
        extra: [codeField(code, clean => { code = clean; go.disabled = !ready() }, t('ql.join.code'))],
        onPick: p => { me = p; render() },
        go
      }), { key: 'join' })
      return
    }
    const back = () => button(t('common.back'), { variant: 'primary', full: true, onClick: () => scene.exit() })
    if (closed) { notice('closed', t('bs.join.closed'), t('bs.join.closedHint'), back()); return }
    if (full) { notice('full', t('bs.join.full'), t('bs.join.fullHint'), back()); return }
    if (!view) {
      notice('knock', t('ql.join.knocking', { code }), status === 'off' ? t('bs.room.offline') : t('ql.join.knockingHint'),
        button(t('common.back'), { variant: 'ghost', full: true, onClick: () => scene.exit() }))
      return
    }
    if (view.phase === 'lobby') {
      stage.view.set(admirals(chairs(view, myPid()), { lit: myPid() }))
      stage.present(page([head(t('ql.join.inRoom'), t('bs.join.waitStart')), el('div', { class: 'guest-wait' }, t('ql.join.waitDots'))]), { key: 'lobby' })
      return
    }
    if (view.phase === 'place' && !view.placed[myPid()] && !fleet && !placer) {
      placer = createPlacer({
        onReady: ships => {
          fleet = ships
          wire.send('fleet', { pid: myPid(), ships })
        }
      })
    }
    if (view.phase === 'over') record()
    else recorded = false
    showMatch(stage, view, {
      placer,
      pending: shot,
      onFire: (r, c) => {
        if (shot) return
        shot = { r, c }
        wire.send('fire', { pid: myPid(), r, c })
        render()
      },
      actions: [
        button(t('bs.over.again'), { variant: 'primary', full: true, onClick: () => wire.send('again', { pid: myPid() }) }),
        button(t('bs.join.out'), { variant: 'secondary', full: true, onClick: () => scene.exit() })
      ]
    })
  }

  render()

  return () => {
    left = true
    clearInterval(knock)
    if (wire) { wire.send('bye', { pid: myPid() }); wire.leave() }
  }
}
