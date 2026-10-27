// Battaglia navale on one phone, passed across the table.
//
// The same match as across two phones (game.js), with the phone itself as
// the wall between the two seas: whoever isn't holding it mustn't see the
// fleet of whoever is. So between one admiral and the other there is always
// a screen with no sea on it — just the face of the one who should take the
// phone now — and the sea comes up only when they say it's them.
import { el, button, walls } from '../../shared/ui.js'
import { t } from '../../shared/i18n.js'
import { faceGrid, newFaceCell, openProfileEditor } from '../../hub/players.js'
import { createGame, PLAYERS } from './game.js'
import { frame, unframe, head, createPlacer, battle, over, cover } from './screens.js'

const PAIR_KEY = 'battleship:pair'

export function mountLocal(container, ctx, { exit }) {
  const game = createGame()
  let step = 'pick'   // pick · cover · place · battle · pass · over
  let holder = null   // pid of whoever has the phone
  let placer = null
  let recorded = false

  // The last two who played on this phone, ready to go again.
  const known = id => ctx.players.get(id)
  let pair = (ctx.storage.get(PAIR_KEY, []) || []).filter(known).slice(0, PLAYERS)

  const player = pid => game.state.players.find(p => p.pid === pid)
  const other = pid => game.state.players.find(p => p.pid !== pid).pid

  const show = children => frame(container, { onBack: () => exit() }, children)

  // ---------- who plays ----------
  function pick() {
    const grid = faceGrid(ctx.players.all(), p => toggle(p.id),
      newFaceCell(t('common.new'), () => openProfileEditor(ctx, null, p => { if (p) toggle(p.id, true) })))
    const all = ctx.players.all()
    all.forEach((p, i) => { if (pair.includes(p.id) && grid.children[i]) grid.children[i].classList.add('on') })
    show([
      head(t('bs.local.title'), t('bs.local.hint')),
      walls(el('div', { class: 'list-scroll' }, grid)),
      button(pair.length === PLAYERS ? t('bs.local.start') : t('bs.local.need', { n: PLAYERS - pair.length }), {
        variant: 'primary', full: true, disabled: pair.length !== PLAYERS, onClick: () => start()
      })
    ])
  }

  function toggle(id, add = false) {
    if (pair.includes(id) && !add) pair = pair.filter(x => x !== id)
    else if (!pair.includes(id)) pair = [...pair, id].slice(-PLAYERS)
    render()
  }

  function start() {
    ctx.storage.set(PAIR_KEY, pair)
    for (const id of pair) {
      const p = ctx.players.get(id)
      game.join({ pid: p.id, name: p.name, color: p.color, emoji: p.emoji })
    }
    game.begin()
    handTo(game.state.players[0].pid)
  }

  // ---------- passing the phone ----------
  function handTo(pid) {
    holder = pid
    step = 'cover'
    render()
  }

  function uncover() {
    if (game.state.phase === 'place') {
      placer = createPlacer({
        onReady: ships => {
          game.place(holder, ships)
          placer = null
          handTo(game.state.phase === 'battle' ? game.state.turn : other(holder))
        }
      })
      step = 'place'
    } else {
      step = 'battle'
    }
    render()
  }

  function fire(r, c) {
    const shot = game.fire(holder, r, c)
    if (!shot) return
    if (game.state.phase === 'over') { step = 'over'; render(); return }
    // Water: the turn is over, but the shooter gets to see where it landed
    // before giving the phone away.
    step = shot.hit ? 'battle' : 'pass'
    render()
  }

  function record() {
    if (recorded) return
    recorded = true
    const ids = game.state.players.map(p => p.pid).filter(known)
    if (!ids.length) return
    ctx.stats.record('battleship', ids, [game.state.winner].filter(known), {
      result: t('bs.over.result', { name: player(game.state.winner).name })
    })
  }

  // ---------- the screens ----------
  function render() {
    if (!container.isConnected) return
    if (step === 'pick') { pick(); return }
    if (step === 'cover') {
      const p = player(holder)
      const placing = game.state.phase === 'place'
      show(cover(p, {
        title: t('bs.local.passTo', { name: p.name }),
        sub: placing ? t('bs.local.placeSub') : t('bs.local.fireSub'),
        onGo: uncover
      }))
      return
    }
    if (step === 'place') {
      show([head(t('bs.place.title', { name: player(holder).name }), ''), placer.node])
      return
    }
    const view = game.viewFor(holder)
    if (step === 'over') {
      record()
      show(over(view, {
        actions: [
          button(t('bs.over.again'), {
            variant: 'primary', full: true,
            onClick: () => { recorded = false; game.again(); handTo(game.state.players[0].pid) }
          }),
          button(t('bs.over.menu'), { variant: 'secondary', full: true, onClick: () => exit() })
        ]
      }))
      return
    }
    const next = other(holder)
    show(battle(view, {
      onFire: fire,
      after: step === 'pass'
        ? button(t('bs.local.give', { name: player(next).name }), { variant: 'primary', full: true, onClick: () => handTo(next) })
        : null
    }))
  }

  render()
  return () => unframe(container)
}
