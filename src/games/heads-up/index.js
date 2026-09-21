// Heads Up — hold the phone on your forehead, others give clues, tilt to score.
import { clear } from '../../shared/ui.js'
import { t } from '../../shared/i18n.js'
import * as screens from './screens.js'
import { createTilt } from './motion.js'
import packs from './packs.js'

const DURATIONS = [30, 60, 90]

// Built on read so the labels follow the interface language.
const menu = () => [
  { title: t('hu.menu.play'), sub: t('hu.menu.playSub'), phase: 'setup', glyph: 'play' },
  { title: t('hu.menu.words'), sub: t('hu.menu.wordsSub'), phase: 'words', glyph: 'words' },
  { title: t('hu.menu.rules'), sub: t('hu.menu.rulesSub'), phase: 'rules', glyph: 'help' }
]

// The rules as data: the hub rides them on the arc (see mister-white/index.js).
const rules = () => [
  {
    title: t('hu.rules.shortSection'),
    items: [
      { title: t('hu.rules.phone'), text: t('hu.rules.phoneDesc') },
      { title: t('hu.rules.clues'), text: t('hu.rules.cluesDesc') },
      { title: t('hu.rules.tilt'), text: t('hu.rules.tiltDesc') }
    ]
  },
  {
    title: t('hu.rules.goalSection'),
    items: [{ title: t('hu.rules.goal'), text: t('hu.rules.goalDesc') }]
  }
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
    toMenu() { stopRuntime(); if (ctx.exitToMenu) ctx.exitToMenu(); else ctx.router.go('/heads-up') }
  }

  function render() {
    clear(container)
    const map = {
      setup: screens.renderSetup,
      ready: screens.renderReady,
      countdown: screens.renderCountdown,
      play: screens.renderPlay,
      results: screens.renderResults
    }
    const fn = map[state.phase] || screens.renderSetup
    container.append(fn(api))
  }

  render()

  // The categories arrive from the database, and the first download lands a
  // second or two after this screen is already up. Nothing else would tell it:
  // the hub watches the same signal to keep the Parole arc honest, but that arc
  // isn't this page. Without this, setup went on saying "download them" with
  // them already on the phone, and Continua stayed dead.
  //
  // Only while choosing: a match already holds its own shuffled list, and
  // swapping the words out from under a round in progress would be worse than
  // finishing it with the list it started from.
  const offPacks = packs.remote && packs.remote.onChange(() => {
    if (!container.isConnected) { offPacks(); return }
    if (state.phase === 'setup') render()
  })

  // Cleanup when the router unmounts the game.
  return () => { stopRuntime(); if (offPacks) offPacks() }
}

export default {
  id: 'heads-up',
  get name() { return t('hu.name') },
  get description() { return t('hu.description') },
  icon: '📱',
  glyph: 'phone',
  packs, // the hub shows them on the right arc of this game's circle
  get rules() { return rules() }, // …and the rules on the same arc
  get menu() { return menu() },
  mount
}
