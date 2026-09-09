// Mister White — game contract + controller.
import { clear } from '../../shared/ui.js'
import * as screens from './screens.js'
import { suggestCounts } from './engine.js'
import packs from './packs.js'

function createState(ctx) {
  const saved = ctx.players.all()
  return {
    phase: 'setup',
    selectedPlayers: saved.slice(0, 20),
    counts: suggestCounts(Math.max(saved.length, 3)),
    round: null,
    dealIndex: 0,
    revealed: false,
    winner: null,
    mrWhiteGuess: null // { name, correct }
  }
}

function mount(container, ctx) {
  const state = createState(ctx)

  const api = {
    ctx,
    state,
    packs,
    render,
    goPhase(phase) { state.phase = phase; render() }
  }

  function render() {
    clear(container)
    const map = {
      setup: screens.renderSetup,
      packs: screens.renderPacks,
      deal: screens.renderDeal,
      play: screens.renderPlay,
      vote: screens.renderVote,
      results: screens.renderResults
    }
    const fn = map[state.phase] || screens.renderSetup
    container.append(fn(api))
  }

  render()
  // No timers/listeners left dangling -> no cleanup needed.
}

export default {
  id: 'mister-white',
  name: 'Mister White',
  description: 'Trova l’impostore che non conosce la parola.',
  icon: '🕵️',
  mount
}
