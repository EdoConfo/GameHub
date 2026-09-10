// Heads Up — hold the phone on your forehead, others give clues, tilt to score.
import { clear } from '../../shared/ui.js'
import * as screens from './screens.js'
import { createTilt } from './motion.js'
import packs from './packs.js'

const DURATIONS = [30, 60, 90]

function createState() {
  const list = packs.enabledPacks()
  return {
    phase: 'home',
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

function mount(container, ctx) {
  const state = createState()

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
    goPhase(phase) { state.phase = phase; render() }
  }

  function render() {
    clear(container)
    const map = {
      home: screens.renderHome,
      setup: screens.renderSetup,
      packs: screens.renderPacks,
      rules: screens.renderRules,
      ready: screens.renderReady,
      countdown: screens.renderCountdown,
      play: screens.renderPlay,
      results: screens.renderResults
    }
    const fn = map[state.phase] || screens.renderHome
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
  mount
}
