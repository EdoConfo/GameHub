// Mister White — game contract + controller.
import { el, clear, icon } from '../../shared/ui.js'
import { t } from '../../shared/i18n.js'
import { createTableStage } from '../../shared/tableStage.js'
import * as match from './match.js'
import packs from './packs.js'

// Menu shown by the hub canvas (the game's own home wheel). "Gioca" opens the
// table right there in the hub (see `table` below). Built on read, not once at
// import: the labels follow the interface language.
const menu = () => [
  { title: t('mw.menu.play'), sub: t('mw.menu.playSub'), phase: 'setup', glyph: 'play' },
  { title: t('mw.menu.words'), sub: t('mw.menu.wordsSub'), phase: 'words', glyph: 'words' },
  { title: t('mw.menu.rules'), sub: t('mw.menu.rulesSub'), phase: 'rules', glyph: 'help' },
  { title: t('mw.menu.stats'), sub: t('mw.menu.statsSub'), phase: 'stats', glyph: 'stats' }
]

// The rules, as sections: the hub rides them on the arc, one bead each, and
// opens the one you pick. Data, not a page — whoever shows them decides how.
const rules = () => [
  {
    title: t('mw.rules.rolesSection'),
    items: [
      { title: t('mw.roles.civili'), text: t('mw.rules.civili') },
      { title: t('mw.role.undercover'), text: t('mw.rules.undercover') },
      { title: t('mw.role.mrwhite'), text: t('mw.rules.mrwhite') },
      { title: t('mw.rules.goddess'), text: t('mw.rules.goddessDesc') }
    ]
  },
  {
    title: t('mw.rules.countSection'),
    items: [
      { title: t('mw.rules.minority'), text: t('mw.rules.minorityDesc') },
      { title: t('mw.rules.suggested'), text: t('mw.rules.suggestedDesc') }
    ]
  },
  {
    title: t('mw.rules.flowSection'),
    items: [
      { title: t('mw.rules.step0'), text: t('mw.rules.step0Desc') },
      { title: t('mw.rules.step1'), text: t('mw.rules.step1Desc') },
      { title: t('mw.rules.step2'), text: t('mw.rules.step2Desc') },
      { title: t('mw.rules.step3'), text: t('mw.rules.step3Desc') }
    ]
  },
  {
    title: t('mw.rules.winSection'),
    items: [
      { title: t('mw.roles.civili'), text: t('mw.rules.winCivili') },
      { title: t('mw.roles.impostori'), text: t('mw.rules.winImpostori') },
      { title: t('mw.role.mrwhite'), text: t('mw.rules.winMrWhite') }
    ]
  }
]

// The match is played around the table (match.js); the rest are plain pages.
const TABLE_PHASES = ['start', 'deal', 'goddess', 'play', 'vote', 'results']

function mount(container, ctx, initialPhase) {
  const state = {
    phase: initialPhase || 'start',
    round: null,
    dealIndex: 0,
    revealed: false,
    winner: null,
    mrWhiteGuess: null, // { name, correct }
    recorded: false
  }
  let stage = null
  let ro = null

  const api = {
    ctx,
    state,
    packs,
    render,
    onSeat: null, // the current phase's handler for taps on the table
    goPhase(phase) { state.phase = phase; render() },
    toMenu() { if (ctx.exitToMenu) ctx.exitToMenu(); else ctx.router.go('/mister-white') },
    toTable() { ctx.router.go('/mister-white/table') }
  }

  // One table screen for the whole match: header, table, drawer. It picks the
  // table up where the hub left it, so arriving here nothing jumps.
  function tableScreen() {
    if (stage) return stage
    clear(container)
    const header = el('div', { class: 'hub-header' }, [
      el('button', { class: 'icon-btn', 'aria-label': t('common.back'), onclick: () => match.leave(api) }, icon('back')),
      el('span', { class: 'wordmark game-home-title' }, t('mw.name').toUpperCase())
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

  function render() {
    api.onSeat = null
    if (state.phase === 'setup') { api.toTable(); return }
    if (TABLE_PHASES.includes(state.phase)) { match[state.phase](api, tableScreen()); return }
    // Everything that isn't played around the table lives in the hub now:
    // words, rules and stats are arcs of the game's own circle.
    teardown()
    clear(container)
    api.toMenu()
  }

  function teardown() {
    if (ro) { ro.disconnect(); ro = null }
    if (stage) { stage.destroy(); stage = null }
  }

  // The table screen continues the hub's scene: no slide-in.
  if (TABLE_PHASES.includes(state.phase)) container.classList.add('on-table')
  render()
  return teardown
}

export default {
  id: 'mister-white',
  get name() { return t('mw.name') },
  get description() { return t('mw.description') },
  icon: '🕵️',
  glyph: 'incognito',
  packs, // the hub shows them on the right arc of this game's circle
  get rules() { return rules() }, // …and the rules on the same arc
  get menu() { return menu() },
  // "Gioca": the hub turns the game's circle into the table; these are this
  // game's options in its drawer, and how a match starts.
  table: {
    min: 3,
    options: match.tableOptions,
    start: ctx => ctx.router.go('/mister-white/start')
  },
  mount
}
