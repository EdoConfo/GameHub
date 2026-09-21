// Heads Up — hold the phone on your forehead, your team gives the clues,
// tilt to score. Game contract + controller.
import { el, clear, icon } from '../../shared/ui.js'
import { t } from '../../shared/i18n.js'
import { createTableStage } from '../../shared/tableStage.js'
import * as screens from './screens.js'
import * as match from './match.js'
import { createTilt } from './motion.js'
import * as teams from './teams.js'
import packs from './packs.js'

// Built on read so the labels follow the interface language.
const menu = () => [
  { title: t('hu.menu.play'), sub: t('hu.menu.playSub'), phase: 'setup', glyph: 'play' },
  { title: t('hu.menu.words'), sub: t('hu.menu.wordsSub'), phase: 'words', glyph: 'words' },
  { title: t('hu.menu.rules'), sub: t('hu.menu.rulesSub'), phase: 'rules', glyph: 'help' },
  { title: t('hu.menu.stats'), sub: t('hu.menu.statsSub'), phase: 'stats', glyph: 'stats' }
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
    title: t('hu.rules.teamsSection'),
    items: [
      { title: t('hu.rules.teams'), text: t('hu.rules.teamsDesc') },
      { title: t('hu.rules.turn'), text: t('hu.rules.turnDesc') }
    ]
  },
  {
    title: t('hu.rules.goalSection'),
    items: [{ title: t('hu.rules.goal'), text: t('hu.rules.goalDesc') }]
  }
]

// Whose turn it is, the tally and the standings happen around the table, like
// a Mister White round. The turn itself takes the whole screen: the phone is on
// a forehead and the table is nobody's business for that minute.
const TABLE_PHASES = ['turn', 'tally', 'standings']
const FULL_PHASES = ['countdown', 'play']

function mount(container, ctx, initialPhase) {
  const state = { phase: initialPhase || 'start' }

  // Runtime handles that must be torn down on leave.
  const runtime = { timer: null, tilt: null, countdown: null }
  let stage = null
  let ro = null

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
    createTilt,
    stopRuntime,
    render,
    goPhase(phase) { state.phase = phase; render() },
    toMenu() { stopRuntime(); if (ctx.exitToMenu) ctx.exitToMenu(); else ctx.router.go('/heads-up') },
    toTable() { stopRuntime(); ctx.router.go('/heads-up/table') }
  }

  // One table screen for the whole match: header, table, drawer. It picks the
  // table up where the hub left it, so arriving here nothing jumps.
  function tableScreen() {
    if (stage) return stage
    clear(container)
    const header = el('div', { class: 'hub-header' }, [
      el('button', { class: 'icon-btn', 'aria-label': t('common.back'), onclick: () => match.leave(api) }, icon('back')),
      el('span', { class: 'wordmark game-home-title' }, t('hu.name').toUpperCase())
    ])
    const shell = el('div', { class: 'canvas' }, [header])
    container.append(shell)
    stage = createTableStage(shell, { top: () => header.offsetTop + header.offsetHeight })
    ro = new ResizeObserver(() => { if (stage) stage.refit() })
    ro.observe(shell)
    return stage
  }

  function teardown() {
    if (ro) { ro.disconnect(); ro = null }
    if (stage) { stage.destroy(); stage = null }
  }

  function render() {
    if (state.phase === 'start') { match.start(api); return }
    if (state.phase === 'setup') { api.toTable(); return }
    if (TABLE_PHASES.includes(state.phase)) { match[state.phase](api, tableScreen()); return }
    if (FULL_PHASES.includes(state.phase)) {
      // The table steps aside for the turn and is built again after it, from
      // where it last stood, so coming back it glides instead of jumping.
      teardown()
      clear(container)
      container.append(state.phase === 'play' ? screens.renderPlay(api) : screens.renderCountdown(api))
      return
    }
    teardown()
    clear(container)
    api.toMenu()
  }

  // The table screen continues the hub's scene: no slide-in.
  if (TABLE_PHASES.includes(state.phase)) container.classList.add('on-table')
  render()

  // The categories arrive from the database, and the first download lands a
  // second or two in. The drawer reads them through check(), which the table
  // calls on every refresh — but nothing refreshes on its own while you sit
  // there looking at it.
  const offPacks = packs.remote && packs.remote.onChange(() => {
    if (!container.isConnected) { offPacks(); return }
    if (TABLE_PHASES.includes(state.phase)) render()
  })

  return () => { stopRuntime(); teardown(); if (offPacks) offPacks() }
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
  // "Gioca": the hub turns the game's circle into the table. Here the table
  // has a job it doesn't have in Mister White — it's where you see the sides.
  table: {
    min: teams.MIN_TEAMS * teams.MIN_PER_TEAM,
    options: match.tableOptions,
    // The chair's colour is its team, right there while you're still arranging
    // people: you see the sides form as you seat them, instead of going into a
    // page to find out what the split turned into.
    seat: (ctx, seat) => {
      const team = teams.assign(ctx.table.seats()).get(seat.id)
      return team == null ? {} : { cls: 'team-' + team, note: match.teamName(team) }
    },
    start: ctx => ctx.router.go('/heads-up/start')
  },
  mount
}
