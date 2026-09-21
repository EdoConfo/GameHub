// Quiplash — everyone answers the same prompt in pairs, the table votes for the
// funnier one. Game contract + controller.
import { el, clear, icon } from '../../shared/ui.js'
import { t } from '../../shared/i18n.js'
import { createTableStage } from '../../shared/tableStage.js'
import * as match from './match.js'
import * as screens from './screens.js'
import { MIN_PLAYERS } from './round.js'
import packs from './packs.js'

// Built on read so the labels follow the interface language.
const menu = () => [
  { title: t('ql.menu.play'), sub: t('ql.menu.playSub'), phase: 'setup', glyph: 'play' },
  { title: t('ql.menu.words'), sub: t('ql.menu.wordsSub'), phase: 'words', glyph: 'bubbles' },
  { title: t('ql.menu.rules'), sub: t('ql.menu.rulesSub'), phase: 'rules', glyph: 'help' },
  { title: t('ql.menu.stats'), sub: t('ql.menu.statsSub'), phase: 'stats', glyph: 'stats' }
]

// The rules as data: the hub rides them on the arc (see mister-white/index.js).
const rules = () => [
  {
    title: t('ql.rules.shortSection'),
    items: [
      { title: t('ql.rules.write'), text: t('ql.rules.writeDesc') },
      { title: t('ql.rules.duel'), text: t('ql.rules.duelDesc') },
      { title: t('ql.rules.vote'), text: t('ql.rules.voteDesc') }
    ]
  },
  {
    title: t('ql.rules.pointsSection'),
    items: [
      { title: t('ql.rules.points'), text: t('ql.rules.pointsDesc') },
      { title: t('ql.rules.sweep'), text: t('ql.rules.sweepDesc') },
      { title: t('ql.rules.rounds'), text: t('ql.rules.roundsDesc') }
    ]
  },
  {
    title: t('ql.rules.tableSection'),
    items: [
      { title: t('ql.rules.secret'), text: t('ql.rules.secretDesc') },
      { title: t('ql.rules.goal'), text: t('ql.rules.goalDesc') }
    ]
  }
]

// Whose turn it is to write, the duels and the standings happen around the
// table. Writing takes the whole screen: the prompt belongs to one person for
// that minute, and the table would be reading over their shoulder.
const TABLE_PHASES = ['pass', 'duel', 'tally', 'standings']
const FULL_PHASES = ['write']

function mount(container, ctx, initialPhase) {
  const state = { phase: initialPhase || 'start' }
  // Runtime handles that must be torn down on leave.
  const runtime = { viewport: null }
  let stage = null
  let ro = null

  function stopRuntime() {
    if (runtime.viewport) { runtime.viewport(); runtime.viewport = null }
  }

  const api = {
    ctx,
    state,
    packs,
    runtime,
    stopRuntime,
    render,
    onSeat: null, // the current phase's handler for taps on the table
    goPhase(phase) { state.phase = phase; render() },
    toMenu() { stopRuntime(); if (ctx.exitToMenu) ctx.exitToMenu(); else ctx.router.go('/quiplash') },
    toTable() { stopRuntime(); ctx.router.go('/quiplash/table') }
  }

  // One table screen for the whole match: header, table, drawer. It picks the
  // table up where the hub left it, so arriving here nothing jumps.
  function tableScreen() {
    if (stage) return stage
    clear(container)
    const header = el('div', { class: 'hub-header' }, [
      el('button', { class: 'icon-btn', 'aria-label': t('common.back'), onclick: () => match.leave(api) }, icon('back')),
      el('span', { class: 'wordmark game-home-title' }, t('ql.name').toUpperCase())
    ])
    const shell = el('div', { class: 'canvas' }, [header])
    container.append(shell)
    stage = createTableStage(shell, {
      top: () => header.offsetTop + header.offsetHeight,
      onTap: i => { if (api.onSeat) api.onSeat(i) }
    })
    ro = new ResizeObserver(() => { if (stage) stage.refit() })
    ro.observe(shell)
    return stage
  }

  function teardown() {
    if (ro) { ro.disconnect(); ro = null }
    if (stage) { stage.destroy(); stage = null }
  }

  function render() {
    api.onSeat = null
    if (state.phase === 'start') { match.start(api); return }
    // A reload lands on an address with no match behind it (the answers lived
    // in memory, as they should). The table is where that address starts again.
    if (state.phase === 'setup' || !state.duels) { teardown(); clear(container); api.toTable(); return }
    if (TABLE_PHASES.includes(state.phase)) { match[state.phase](api, tableScreen()); return }
    if (FULL_PHASES.includes(state.phase)) {
      // The table steps aside while somebody writes and is built again after,
      // from where it last stood, so coming back it glides instead of jumping.
      stopRuntime()
      teardown()
      clear(container)
      const node = screens.renderWrite(api)
      container.append(node)
      // Still inside the tap that asked for this screen: the keyboard comes up
      // with it instead of costing a second tap.
      if (node.ready) node.ready()
      return
    }
    teardown()
    clear(container)
    api.toMenu()
  }

  // The table screen continues the hub's scene: no slide-in.
  if (TABLE_PHASES.includes(state.phase)) container.classList.add('on-table')
  render()

  // The prompts arrive from the database, and the first download lands a second
  // or two in. Nothing on screen refreshes on its own while you sit there
  // looking at it, so it is asked for here.
  const offPacks = packs.remote && packs.remote.onChange(() => {
    if (!container.isConnected) { offPacks(); return }
    if (TABLE_PHASES.includes(state.phase)) render()
  })

  return () => { stopRuntime(); teardown(); if (offPacks) offPacks() }
}

export default {
  id: 'quiplash',
  get name() { return t('ql.name') },
  get description() { return t('ql.description') },
  icon: '💬',
  glyph: 'bubbles',
  packs, // the hub shows them on the right arc of this game's circle
  get rules() { return rules() }, // …and the rules on the same arc
  get menu() { return menu() },
  // "Gioca": the hub turns the game's circle into the table; these are this
  // game's options in its drawer, and how a match starts.
  table: {
    min: MIN_PLAYERS,
    options: match.tableOptions,
    start: ctx => ctx.router.go('/quiplash/start')
  },
  mount
}
