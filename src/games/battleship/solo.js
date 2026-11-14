// Battaglia navale against the computer: one admiral, one phone, nobody to
// pass it to.
//
// The same match as every other way of playing it (game.js), with the other
// admiral played by ai.js. The computer is handed its own view and nothing
// else, exactly like a phone that joined a room — it never sees your fleet,
// it only finds it.
import { el, button } from '../../shared/ui.js'
import { t } from '../../shared/i18n.js'
import { createGame } from './game.js'
import { randomFleet } from './engine.js'
import { pickShot, LEVELS } from './ai.js'
import { page, head, createPlacer, battle, over } from './screens.js'
import { whoPage, savedMe, face, ME_KEY } from './room.js'

const LEVEL_KEY = 'battleship:level'
const CPU = 'cpu'
// The computer takes a breath before every shot: long enough to read where
// the last one landed, short enough not to be waited for.
const THINK = 850

export function placeSolo(scene, ctx) {
  const { panel } = scene
  let me = savedMe(ctx)
  let level = ctx.storage.get(LEVEL_KEY, 'medium')
  if (!LEVELS.includes(level)) level = 'medium'
  let placer = null
  let thinking = 0
  let gone = false

  const game = createGame({ onChange: () => { render(); think() } })

  // ---------- the computer's side ----------
  function think() {
    if (gone || thinking || game.state.phase !== 'battle' || game.state.turn !== CPU) return
    thinking = setTimeout(() => {
      thinking = 0
      if (gone || game.state.phase !== 'battle' || game.state.turn !== CPU) return
      const shot = pickShot(game.viewFor(CPU), level)
      if (shot) game.fire(CPU, shot.r, shot.c)
    }, THINK)
  }

  // Fresh seas: the computer's fleet goes out at once, yours when you say so.
  function deal() {
    placer = createPlacer({ onReady: ships => { if (!game.place(me.id, ships)) placer.reopen() } })
    game.place(CPU, randomFleet())
  }

  function start() {
    if (!me) return
    ctx.storage.set(ME_KEY, me.id)
    ctx.storage.set(LEVEL_KEY, level)
    game.join(face(me))
    game.join({ pid: CPU, name: t('bs.solo.cpu'), color: '#5b6b7a', emoji: '🤖' })
    game.begin()
    deal()
  }

  // ---------- the pages ----------
  function setup() {
    const chips = el('div', { class: 'chip-list bs-levels' }, LEVELS.map(l =>
      el('button', {
        class: 'chip selectable' + (l === level ? ' on' : ''),
        'aria-pressed': String(l === level),
        onclick: () => { level = l; render() }
      }, t('bs.solo.level.' + l))))
    panel.present(whoPage(ctx, {
      me,
      title: t('bs.solo.title'),
      hint: t('bs.solo.levelHint.' + level),
      extra: [el('span', { class: 'field-label' }, t('bs.solo.level')), chips],
      onPick: p => { me = p; render() },
      go: button(t('bs.local.start'), { variant: 'primary', full: true, disabled: !me, onClick: start })
    }), { key: 'setup' })
  }

  function render() {
    if (gone) return
    const phase = game.state.phase
    if (phase === 'lobby') { setup(); return }
    if (phase === 'place') {
      if (!placer) return
      panel.present(page([head(t('bs.place.titleMine'), ''), placer.node]), { key: 'place' })
      return
    }
    placer = null
    const view = game.viewFor(me.id)
    if (phase === 'over') {
      panel.present(page(over(view, {
        actions: [
          button(t('bs.over.again'), { variant: 'primary', full: true, onClick: () => { game.again(); deal() } }),
          button(t('bs.over.menu'), { variant: 'secondary', full: true, onClick: () => scene.exit() })
        ]
      })), { key: 'over' })
      return
    }
    panel.present(page(battle(view, { onFire: (r, c) => game.fire(me.id, r, c) })), { key: 'battle' })
  }

  render()
  return () => { gone = true; clearTimeout(thinking) }
}
