// Heads Up — hold the phone on your forehead, others give clues, tilt to score.
import { clear } from '../../shared/ui.js'
import * as screens from './screens.js'
import { createTilt } from './motion.js'
import packs from './packs.js'

const DURATIONS = [30, 60, 90]

const MENU = [
  { title: 'Gioca', sub: 'Nuova partita', phase: 'setup', glyph: 'play' },
  { title: 'Parole', sub: 'Categorie', phase: 'packs', glyph: 'words' },
  { title: 'Come si gioca', sub: 'Regole', phase: 'rules', glyph: 'help' }
]

function createState(initialPhase) {
  const list = packs.enabledPacks()
  return {
    phase: initialPhase || 'setup',
    packId: list[0]?.id || packs.allPacks()[0]?.id || null,
    duration: 60,
    invert: false,
    words: [],
    index: 0,
    results: [],
    score: 0,
    timeLeft: 0
  }
}

function mount(container, ctx, initialPhase) {
  const state = createState(initialPhase)

  // Shared runtime handles that must be torn down on leave.
  const runtime = { timer: null, tilt: null, countdown: null }

  function stopRuntime() {
    if (runtime.timer) { clearInterval(runtime.timer); runtime.timer = null }
    if (runtime.countdown) { clearInterval(runtime.countdown); runtime.countdown = null }
    if (runtime.tilt) { runtime.tilt.stop(); runtime.tilt = null }
  }

  const api = {
    ctx,
    state,
    packs,
    runtime,
    DURATIONS,
    createTilt,
    stopRuntime,
    render,
    goPhase(phase) { state.phase = phase; render() },
    toMenu() { stopRuntime(); if (ctx.exitToMenu) ctx.exitToMenu(); else ctx.router.go('/menu/heads-up') }
  }

  function render() {
    clear(container)
    const map = {
      setup: screens.renderSetup,
      packs: screens.renderPacks,
      rules: screens.renderRules,
      ready: screens.renderReady,
      countdown: screens.renderCountdown,
      play: screens.renderPlay,
      results: screens.renderResults
    }
    const fn = map[state.phase] || screens.renderSetup
    container.append(fn(api))
  }

  render()

  // Cleanup when the router unmounts the game.
  return () => stopRuntime()
}

export default {
  id: 'heads-up',
  name: 'Heads Up',
  description: 'Telefono in fronte: indovina la parola dagli indizi.',
  icon: '📱',
  glyph: 'phone',
  menu: MENU,
  mount
}
