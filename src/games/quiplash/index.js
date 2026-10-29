// Quiplash — everyone answers the same prompt in pairs, the table votes for the
// funnier one. Game contract + controller.
import { el, clear, icon } from '../../shared/ui.js'
import { t } from '../../shared/i18n.js'
import { createTableStage } from '../../shared/tableStage.js'
import * as match from './match.js'
import { placeRoom } from './room.js'
import { placeGuest } from './guest.js'
import { keepAbove } from '../../shared/roomUi.js'
import { MIN_PLAYERS } from './round.js'
import packs from './packs.js'

// Built on read so the labels follow the interface language.
// Quiplash is the one game here played on several phones at once: writing is
// private and simultaneous, which one phone passed around can only imitate by
// taking turns. So the room comes first, joining one second, and the single
// phone stays underneath for when there is no network — or no second phone.
const menu = () => [
  { title: t('ql.menu.play'), sub: t('ql.menu.playSub'), phase: 'room', glyph: 'play' },
  { title: t('ql.menu.join'), sub: t('ql.menu.joinSub'), phase: 'join', glyph: 'enter' },
  { title: t('ql.menu.alone'), sub: t('ql.menu.aloneSub'), phase: 'setup', glyph: 'phone' },
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

// Everything happens around the table. Writing too: the prompt belongs to one
// person for that minute, so it rises as a sheet that covers the drawer whole,
// with the table still standing above it.
const TABLE_PHASES = ['pass', 'write', 'duel', 'tally', 'standings']
// The two places of a match played across phones — the room and the way in —
// are not phases of this screen: they stand on the game's own table in the
// hub (`places` below, room.js, guest.js).

function mount(container, ctx, initialPhase) {
  const state = { phase: initialPhase || 'start' }
  // Runtime handles that must be torn down on leave.
  const runtime = { viewport: null }
  let stage = null
  let ro = null
  let keep = null // the scene following the keyboard, while somebody writes

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

  // Somebody writing on the phone passed round: their sheet over the table,
  // and the scene shortened to what the keyboard leaves. Pulled down before
  // the answers are in, it gives the phone back to the same person.
  function writeSheet() {
    const st = tableScreen()
    match.pass(api, st)
    const node = match.write(api)
    const shell = container.querySelector('.canvas')
    if (shell && !keep) keep = keepAbove(shell)
    runtime.viewport = () => {
      node.stop()
      if (keep) { keep(); keep = null }
      if (shell) { shell.style.height = ''; shell.style.transform = '' }
    }
    st.openSheet(node, {
      done: () => {
        if (state.phase !== 'write') return
        stopRuntime()
        api.goPhase('pass')
      }
    })
    // Still inside the tap that asked for this sheet: the keyboard comes up
    // with it instead of costing a second tap.
    node.ready()
  }

  function render() {
    api.onSeat = null
    if (state.phase === 'room' || state.phase === 'join') {
      // an old address: the rooms live on the game's table in the hub now
      ctx.router.go('/quiplash/' + state.phase)
      return
    }
    if (state.phase === 'start') { match.start(api); return }
    // A reload lands on an address with no match behind it (the answers lived
    // in memory, as they should). The table is where that address starts again.
    if (state.phase === 'setup' || !state.duels) { teardown(); clear(container); api.toTable(); return }
    if (state.phase === 'write') { writeSheet(); return }
    // the sheet goes down with what it held, whichever way the phase moved on
    if (stage && runtime.viewport) { stopRuntime(); stage.closeSheet() }
    if (TABLE_PHASES.includes(state.phase)) { match[state.phase](api, tableScreen()); return }
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
    // not while somebody writes: that would start their sheet over
    if (TABLE_PHASES.includes(state.phase) && state.phase !== 'write') render()
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
  // a room on this phone, or a way into one on another: both stand on the
  // game's own table, which the menu's circle becomes
  places: { room: placeRoom, join: placeGuest },
  mount
}
