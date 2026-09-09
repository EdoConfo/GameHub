// Mister White — game contract + controller.
import { clear } from '../../shared/ui.js'
import * as screens from './screens.js'
import { suggestCounts } from './engine.js'
import packs from './packs.js'

function createState(ctx) {
  const roster = ctx.players.all()
  const ids = roster.slice(0, 20).map(p => p.id)
  return {
    phase: 'home',
    selectedIds: ids,
    counts: suggestCounts(Math.max(ids.length, 3)),
    round: null,
    dealIndex: 0,
    revealed: false,
    winner: null,
    mrWhiteGuess: null, // { name, correct }
    recorded: false
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
      home: screens.renderHome,
      setup: screens.renderSetup,
      packs: screens.renderPacks,
      rules: screens.renderRules,
      stats: screens.renderStats,
      deal: screens.renderDeal,
      play: screens.renderPlay,
      vote: screens.renderVote,
      results: screens.renderResults
    }
    const fn = map[state.phase] || screens.renderHome
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
