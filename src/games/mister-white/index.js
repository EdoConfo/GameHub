// Mister White — game contract + controller.
import { clear } from '../../shared/ui.js'
import * as screens from './screens.js'
import { suggestCounts } from './engine.js'
import packs from './packs.js'

// Menu shown by the hub canvas (the game's own home wheel).
const MENU = [
  { title: 'Gioca', sub: 'Nuova partita', phase: 'setup', glyph: 'play' },
  { title: 'Parole', sub: 'Pacchetti e coppie', phase: 'packs', glyph: 'words' },
  { title: 'Come si gioca', sub: 'Regole e ruoli', phase: 'rules', glyph: 'help' },
  { title: 'Statistiche', sub: 'Partite e vittorie', phase: 'stats', glyph: 'stats' }
]

function createState(ctx, initialPhase) {
  const roster = ctx.players.all()
  const ids = roster.slice(0, 20).map(p => p.id)
  return {
    phase: initialPhase || 'setup',
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

function mount(container, ctx, initialPhase) {
  const state = createState(ctx, initialPhase)

  const api = {
    ctx,
    state,
    packs,
    render,
    goPhase(phase) { state.phase = phase; render() },
    toMenu() { if (ctx.exitToMenu) ctx.exitToMenu(); else ctx.router.go('/menu/mister-white') }
  }

  function render() {
    clear(container)
    const map = {
      setup: screens.renderSetup,
      packs: screens.renderPacks,
      rules: screens.renderRules,
      stats: screens.renderStats,
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
  glyph: 'incognito',
  menu: MENU,
  mount
}
