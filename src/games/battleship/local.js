// Battaglia navale on one phone, passed across the table.
//
// The same match as across two phones (game.js), with the phone itself as
// the wall between the two seas: whoever isn't holding it mustn't see the
// fleet of whoever is. So between one admiral and the other the sea goes down
// with the drawer, the table turns to put the next one's chair at the bottom,
// and the sea comes back up only when they say it's them.
import { el, button, walls } from '../../shared/ui.js'
import { t } from '../../shared/i18n.js'
import { faceGrid, newFaceCell, openProfileEditor } from '../../hub/players.js'
import { createGame, PLAYERS } from './game.js'
import { page, head, admirals, createPlacer, battle, over, cover } from './screens.js'

const PAIR_KEY = 'battleship:pair'

const face = p => ({ pid: p.id, name: p.name, color: p.color, emoji: p.emoji })

// The place the hub gives this game for "Un telefono": the table circle B
// became, and its drawer.
export function placeLocal(scene, ctx) {
  const { stage } = scene
  const game = createGame()
  let step = 'pick'   // pick · cover · place · battle · pass · over
  let holder = null   // pid of whoever has the phone
  let placer = null
  let recorded = false
  let gone = false

  // The last two who played on this phone, ready to go again.
  const known = id => ctx.players.get(id)
  let pair = (ctx.storage.get(PAIR_KEY, []) || []).filter(known).slice(0, PLAYERS)

  const player = pid => game.state.players.find(p => p.pid === pid)
  const other = pid => game.state.players.find(p => p.pid !== pid).pid
  // whoever holds the phone first: their chair is the one at the bottom
  const round = () => [player(holder), player(other(holder))]

  // ---------- who plays ----------
  function pick() {
    const all = ctx.players.all()
    const grid = faceGrid(all, p => toggle(p.id),
      newFaceCell(t('common.new'), () => openProfileEditor(ctx, null, p => { if (p) toggle(p.id, true) })))
    all.forEach((p, i) => { if (pair.includes(p.id) && grid.children[i]) grid.children[i].classList.add('on') })
    // the chairs fill as the faces are picked
    stage.view.set(admirals(pair.map(id => face(ctx.players.get(id)))))
    stage.view.setCenter(null)
    stage.present(page([
      head(t('bs.local.title'), t('bs.local.hint')),
      walls(el('div', { class: 'list-scroll' }, grid)),
      button(pair.length === PLAYERS ? t('bs.local.start') : t('bs.local.need', { n: PLAYERS - pair.length }), {
        variant: 'primary', full: true, disabled: pair.length !== PLAYERS, onClick: () => start()
      })
    ]), { key: 'pick' })
  }

  function toggle(id, add = false) {
    if (pair.includes(id) && !add) pair = pair.filter(x => x !== id)
    else if (!pair.includes(id)) pair = [...pair, id].slice(-PLAYERS)
    render()
  }

  function start() {
    ctx.storage.set(PAIR_KEY, pair)
    for (const id of pair) game.join(face(ctx.players.get(id)))
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

  // ---------- the drawer, step by step ----------
  function render() {
    if (gone) return
    if (step === 'pick') { pick(); return }
    if (step === 'cover') {
      const p = player(holder)
      const placing = game.state.phase === 'place'
      stage.view.set(admirals(round(), { lit: holder }))
      stage.present(page(cover(p, {
        title: t('bs.local.passTo', { name: p.name }),
        sub: placing ? t('bs.local.placeSub', { name: p.name }) : t('bs.local.fireSub', { name: p.name }),
        onGo: uncover
      })), { key: 'cover' })
      return
    }
    if (step === 'place') {
      stage.view.set(admirals(round(), { lit: holder, names: false }))
      stage.present(page([head(t('bs.place.title', { name: player(holder).name }), ''), placer.node], { tall: true }), { key: 'place' })
      return
    }
    const view = game.viewFor(holder)
    if (step === 'over') {
      record()
      stage.view.set(admirals(round(), { lit: game.state.winner, dim: [other(game.state.winner)] }))
      stage.present(page(over(view, {
        actions: [
          button(t('bs.over.again'), {
            variant: 'primary', full: true,
            onClick: () => { recorded = false; game.again(); handTo(game.state.players[0].pid) }
          }),
          button(t('bs.over.menu'), { variant: 'secondary', full: true, onClick: () => scene.exit() })
        ]
      }), { tall: true }), { key: 'over' })
      return
    }
    const next = other(holder)
    stage.view.set(admirals(round(), { lit: game.state.turn, names: false }))
    stage.present(page(battle(view, {
      onFire: fire,
      after: step === 'pass'
        ? button(t('bs.local.give', { name: player(next).name }), { variant: 'primary', full: true, onClick: () => handTo(next) })
        : null
    }), { tall: true }), { key: 'battle' })
  }

  render()
  return () => { gone = true }
}
