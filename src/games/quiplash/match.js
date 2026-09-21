// A Quiplash match, played around the table: the table stays at the top, the
// drawer below says what to do now. Writing is the one thing that leaves it —
// the phone is in somebody's hands and the answer is nobody else's business
// until the duel (screens.js).
//
//   start -> pass -> write -> … -> duel -> tally -> … -> standings
import { el, button, icon, modal, walls, shuffle } from '../../shared/ui.js'
import { t } from '../../shared/i18n.js'
import {
  MIN_PLAYERS, ROUNDS, buildRound, votersFor, castVotes, tallyDuel, ranking, outcome
} from './round.js'
import packs from './packs.js'

const OPTS_KEY = 'quiplash:options'

// "1 giro" / "3 giri" — the same label on the chip and on the door.
const roundsLabel = n => (n === 1 ? t('ql.opt.oneRound') : t('ql.opt.nRounds', { n }))

const page = (children, cls = '') => el('div', { class: 'drawer-page' + (cls ? ' ' + cls : '') }, children)
const count = (big, small) => el('div', { class: 'table-count' }, [el('b', {}, big), el('span', {}, small)])

export function loadOptions(ctx) {
  const raw = ctx.storage.get(OPTS_KEY, null) || {}
  return { rounds: ROUNDS.includes(raw.rounds) ? raw.rounds : 2 }
}
const saveOptions = (ctx, o) => ctx.storage.set(OPTS_KEY, o)

// Only the chairs with somebody on them play: an empty chair has nobody to
// write, and a prompt nobody answers is a duel with one side.
function seated(ctx) {
  const roster = new Map(ctx.players.all().map(p => [p.id, p]))
  const out = []
  for (const s of ctx.table.seats()) {
    const p = s.pid ? roster.get(s.pid) : null
    if (p) out.push({ id: p.id, name: p.name, seat: s.id })
  }
  return out
}

// The table's chairs as items; `look(player, profile)` dresses each one.
// `player` is the index into state.players, or null for a chair out of play.
function seatItems(api, look) {
  const { ctx, state } = api
  const roster = new Map(ctx.players.all().map(p => [p.id, p]))
  const at = new Map((state.players || []).map((p, i) => [p.seat, i]))
  return ctx.table.seats().map((s, i) => {
    const profile = s.pid ? roster.get(s.pid) || null : null
    const k = at.has(s.id) ? at.get(s.id) : null
    return {
      key: s.id || 'seat-' + i,
      p: profile,
      name: profile ? profile.name : t('table.free'),
      ...(look(k, profile) || {})
    }
  })
}

// Who is sitting on table chair `i` — null for a chair out of this match.
function playerAt(api, i) {
  const seat = api.ctx.table.seats()[i]
  if (!seat) return null
  const k = api.state.players.findIndex(p => p.seat === seat.id)
  return k < 0 ? null : k
}

// ---------- before the match: this game's knobs in the table drawer ----------
export function tableOptions(ctx, ui) {
  let paintPage = null

  function door(label, onClick) {
    const value = el('span', { class: 'opt-value' })
    const node = el('button', { class: 'opt-row opt-door', onclick: onClick }, [
      el('span', { class: 'opt-label' }, label),
      el('span', { class: 'opt-door-value' }, [value, icon('forward')])
    ])
    return { node, set: text => { value.textContent = text } }
  }

  const promptsDoor = door(t('ql.opt.prompts'), () => openPrompts())
  const roundDoor = door(t('ql.opt.round'), () => openRound())
  const node = el('div', { class: 'opt-list' }, [promptsDoor.node, roundDoor.node])

  function promptsSummary() {
    // The prompts arrive with the first network the app sees. Until then the
    // pool is empty through nobody's choice, and "choose some" is the wrong
    // advice.
    if (!packs.allPacks().length && packs.remote && !packs.remote.has()) return t('ql.opt.baseMissing')
    const on = packs.enabledPacks()
    if (!on.length) return t('ql.opt.choose')
    return t('ql.opt.nPrompts', { n: packs.enabledItems().length })
  }

  const roundSummary = () => roundsLabel(loadOptions(ctx).rounds)

  // ---------- Domande: which packs this match draws from ----------
  function openPrompts() {
    const list = walls(el('div', { class: 'pack-pick-list list-scroll' }))
    paintPage = () => {
      const all = packs.allPacks()
      if (!all.length) {
        list.replaceChildren(el('p', { class: 'drawer-hint' },
          t(packs.remote && !packs.remote.has() ? 'ql.setup.promptsMissing' : 'ql.setup.noPacks')))
        return
      }
      const on = new Set(packs.enabledIds())
      list.replaceChildren(...all.map(p => el('button', {
        class: 'pack-pick' + (on.has(p.id) ? ' on' : ''),
        'aria-pressed': on.has(p.id) ? 'true' : 'false',
        onclick: () => { packs.toggleEnabled(p.id); ui.changed() }
      }, [
        el('span', { class: 'pack-pick-check' }, icon('check')),
        el('span', { class: 'pack-text' }, [
          el('span', { class: 'pack-name' }, p.name),
          el('span', { class: 'pack-count' }, `${p.items.length} ${packs.unit}`)
        ])
      ])))
    }
    paintPage()
    ui.open(t('ql.opt.prompts'), [el('p', { class: 'drawer-hint' }, t('ql.opt.promptsHint')), list])
  }

  // ---------- Il giro: how many rounds ----------
  function openRound() {
    const rounds = el('div', { class: 'chip-list' })
    paintPage = () => {
      const o = loadOptions(ctx)
      rounds.replaceChildren(...ROUNDS.map(n => el('button', {
        class: 'chip selectable' + (o.rounds === n ? ' on' : ''),
        onclick: () => { saveOptions(ctx, { ...loadOptions(ctx), rounds: n }); ui.changed() }
      }, roundsLabel(n))))
    }
    paintPage()
    ui.open(t('ql.opt.round'), [
      el('p', { class: 'drawer-hint' }, t('ql.opt.roundHint')),
      rounds,
      el('p', { class: 'drawer-hint' }, t('ql.opt.pointsHint'))
    ])
  }

  return {
    node,
    // -> '' when a match can start, else why not
    check() {
      promptsDoor.set(promptsSummary())
      roundDoor.set(roundSummary())
      if (paintPage) paintPage()
      const people = seated(ctx)
      if (people.length < MIN_PLAYERS) return t('ql.setup.needPlayers', { n: MIN_PLAYERS })
      if (!packs.allPacks().length && packs.remote && !packs.remote.has()) return t('ql.setup.promptsMissing')
      const pool = packs.enabledItems().length
      if (!pool) return t('ql.setup.pickPack')
      // One round without repeats: a prompt coming round twice in the same
      // round is the same duel played twice.
      if (pool < people.length) return t('ql.setup.morePrompts', { n: people.length })
      return ''
    }
  }
}

// ---------- start: the people, the prompts, the first round ----------
export function start(api) {
  const { ctx, state } = api
  const people = seated(ctx)
  const pool = packs.enabledItems()
  if (people.length < MIN_PLAYERS || pool.length < people.length) { api.toTable(); return }

  const o = loadOptions(ctx)
  // One shuffled pool for the whole match, walked straight through: no round
  // repeats a prompt another round has already used, unless the pool runs dry.
  Object.assign(state, {
    players: people.map(p => ({ ...p, score: 0 })),
    pool: shuffle(pool),
    cursor: 0,
    rounds: o.rounds,
    round: 0,
    recorded: false
  })
  beginRound(state)
  api.goPhase('pass')
}

// The next `n` prompts. Only if the pool runs out does it shuffle and come
// round again — better a repeat than a duel with nothing to answer.
function take(state, n) {
  const out = []
  for (let i = 0; i < n; i++) {
    if (state.cursor >= state.pool.length) { state.pool = shuffle(state.pool); state.cursor = 0 }
    out.push(state.pool[state.cursor++])
  }
  return out
}

function beginRound(state) {
  state.duels = buildRound(state.players.length, take(state, state.players.length), state.round)
  state.writeIndex = 0
  state.writeStep = 0
  state.duelIndex = 0
  state.revealed = false
}

const roundLine = state => (state.rounds > 1 ? t('ql.round.of', { n: state.round + 1, of: state.rounds }) : '')

// ---------- pass: the phone goes round, two answers each ----------
export function pass(api, stage) {
  const { state } = api
  const me = state.players[state.writeIndex]

  stage.view.set(seatItems(api, k => (k === state.writeIndex ? { cls: 'on' } : { cls: 'dim' })))
  stage.view.setCenter(count(`${state.writeIndex + 1}/${state.players.length}`, t('ql.pass.counter')))

  stage.present(page([
    roundLine(state) ? el('p', { class: 'drawer-kicker' }, roundLine(state)) : null,
    el('p', { class: 'drawer-kicker' }, t('ql.pass.kicker')),
    el('div', { class: 'drawer-name' }, me.name),
    el('p', { class: 'drawer-hint' }, t('ql.pass.hint')),
    button(t('ql.pass.mine'), {
      variant: 'primary', full: true,
      onClick: () => { state.writeStep = 0; api.goPhase('write') }
    })
  ], 'steady'))
}

// Called by the writing screen when somebody has finished their two answers.
export function written(api) {
  const { state } = api
  state.writeIndex++
  state.writeStep = 0
  if (state.writeIndex < state.players.length) { api.goPhase('pass'); return }
  state.duelIndex = 0
  state.revealed = false
  api.goPhase('duel')
}

// ---------- duel: two answers, and everyone else votes ----------
export function duel(api, stage) {
  const { state } = api
  const d = state.duels[state.duelIndex]
  const n = state.players.length
  const authors = new Set(d.answers.map(a => a.by))
  const voters = votersFor(d, n)

  function paint() {
    const cast = castVotes(d, n)
    stage.view.set(seatItems(api, k => {
      if (k == null) return { cls: 'dim' }
      if (authors.has(k)) return { cls: 'out', note: t('ql.duel.wrote') }
      if (!state.revealed) return {}
      const v = d.votes[k]
      return v == null ? {} : { cls: 'team-' + v + ' on', note: t('ql.duel.chose', { n: v + 1 }) }
    }))
    stage.view.setCenter(state.revealed
      ? count(`${cast}/${voters.length}`, cast === 1 ? t('ql.duel.vote') : t('ql.duel.votes'))
      : count(`${state.duelIndex + 1}/${state.duels.length}`, t('ql.duel.counter')))

    if (!state.revealed) {
      stage.present(page([
        roundLine(state) ? el('p', { class: 'drawer-kicker' }, roundLine(state)) : null,
        el('div', { class: 'drawer-prompt' }, d.prompt),
        el('p', { class: 'drawer-hint' }, t('ql.duel.readHint')),
        button(t('ql.duel.reveal'), {
          variant: 'primary', full: true,
          onClick: () => { state.revealed = true; paint() }
        })
      ], 'steady'))
      return
    }

    const missing = voters.length - cast
    stage.present(page([
      el('p', { class: 'drawer-hint' }, d.prompt),
      walls(el('div', { class: 'answer-list list-scroll' }, d.answers.map((a, slot) =>
        el('div', { class: 'answer-row team-' + slot }, [
          el('span', { class: 'team-dot' }),
          el('span', { class: 'answer-text' }, a.text),
          el('b', { class: 'answer-votes' }, String(
            voters.filter(i => d.votes[i] === slot).length))
        ])))),
      el('p', { class: 'drawer-hint' }, t('ql.duel.voteHint')),
      button(missing
        ? (missing === 1 ? t('ql.duel.missingOne') : t('ql.duel.missing', { n: missing }))
        : t('ql.duel.count'), {
        variant: 'primary', full: true, disabled: !!missing,
        onClick: () => api.goPhase('tally')
      })
    ]))
  }

  // Tap a chair and its vote moves on: first answer, second answer, no vote.
  // The two who wrote are out of it, and say so.
  api.onSeat = i => {
    if (!state.revealed) return
    const k = playerAt(api, i)
    if (k == null || authors.has(k)) return
    const v = d.votes[k]
    if (v == null) d.votes[k] = 0
    else if (v === 0) d.votes[k] = 1
    else delete d.votes[k]
    paint()
  }

  paint()
}

// ---------- tally: who wrote what, and what it was worth ----------
export function tally(api, stage) {
  const { state } = api
  const d = state.duels[state.duelIndex]
  const rows = tallyDuel(d, state.players.length)

  // Written once: coming back to this screen must not pay for the duel twice.
  if (!d.scored) {
    d.scored = true
    for (const r of rows) state.players[r.by].score += r.points
  }

  const best = Math.max(...rows.map(r => r.votes))
  const won = new Map(rows.map(r => [r.by, r]))
  stage.view.set(seatItems(api, k => {
    const r = k == null ? null : won.get(k)
    if (!r) return { cls: 'dim' }
    return { cls: r.votes === best && best > 0 ? 'on' : '', note: r.points ? '+' + r.points : t('ql.tally.nothing') }
  }))
  stage.view.setCenter(count(`${state.duelIndex + 1}/${state.duels.length}`, t('ql.duel.counter')))

  const last = state.duelIndex + 1 >= state.duels.length
  stage.present(page([
    el('p', { class: 'drawer-hint' }, d.prompt),
    el('div', { class: 'answer-list' }, rows.map(r => el('div', {
      class: 'answer-row team-' + r.slot + (r.votes === best && best > 0 ? ' won' : '')
    }, [
      el('span', { class: 'team-dot' }),
      el('span', { class: 'answer-text' }, r.text),
      el('span', { class: 'answer-by' }, [
        state.players[r.by].name,
        r.sweep ? el('b', { class: 'answer-sweep' }, t('ql.tally.sweep')) : null
      ]),
      el('b', { class: 'answer-votes' }, r.points ? '+' + r.points : '0')
    ]))),
    button(last ? t('ql.tally.standings') : t('ql.tally.next'), {
      variant: 'primary', full: true,
      onClick: () => {
        state.duelIndex++
        state.revealed = false
        api.goPhase(last ? 'standings' : 'duel')
      }
    })
  ]))
}

// ---------- standings: after every round, and at the end ----------
export function standings(api, stage) {
  const { ctx, state } = api
  const final = state.round + 1 >= state.rounds
  const { winners, draw } = outcome(state.players)
  const order = ranking(state.players)
  const lead = order[0]

  if (final && !state.recorded) {
    state.recorded = true
    const everyone = state.players.map(p => p.id)
    if (everyone.length) {
      ctx.stats.record('quiplash', everyone, winners.map(p => p.id), {
        result: draw ? t('ql.standings.draw') : t('ql.standings.won', { name: winners[0].name })
      })
    }
  }

  const up = new Set((final && !draw ? winners : [lead]).map(p => p.id))
  stage.view.set(seatItems(api, k => {
    if (k == null) return { cls: 'dim' }
    const p = state.players[k]
    return { cls: up.has(p.id) ? 'on' : 'dim', note: String(p.score) }
  }))
  stage.view.setCenter(null)

  const title = final
    ? (draw ? t('ql.standings.draw') : t('ql.standings.won', { name: winners[0].name }))
    : t('ql.standings.title')

  stage.present(page([
    el('div', { class: 'drawer-title' }, title),
    !final && roundLine(state) ? el('p', { class: 'drawer-hint' }, roundLine(state)) : null,
    walls(el('div', { class: 'rank-list list-scroll' }, order.map((p, i) => el('div', {
      class: 'rank-row' + (up.has(p.id) ? ' lead' : '')
    }, [
      el('span', { class: 'rank-num' }, String(i + 1)),
      el('span', { class: 'rank-name' }, p.name),
      el('b', { class: 'rank-value' }, String(p.score))
    ])))),
    final
      ? el('div', { class: 'row stack' }, [
        button(t('ql.standings.again'), { variant: 'primary', full: true, onClick: () => start(api) }),
        button(t('ql.standings.change'), { variant: 'secondary', full: true, onClick: () => api.toTable() })
      ])
      : button(t('ql.standings.next', { n: state.round + 2 }), {
        variant: 'primary', full: true,
        onClick: () => { state.round++; beginRound(state); api.goPhase('pass') }
      })
  ]))
}

// Leaving mid-match: free before anybody has written, otherwise it throws the
// answers away, so ask first.
export function leave(api) {
  const { state } = api
  const written = state.duels && state.duels.some(d => d.answers.some(a => a.text))
  if (!written || state.phase === 'standings') { api.toTable(); return }
  const m = modal({
    title: t('ql.leave.title'),
    content: [el('p', { class: 'muted' }, t('ql.leave.body'))],
    actions: [
      button(t('ql.leave.stay'), { variant: 'ghost', onClick: () => m.close() }),
      button(t('ql.leave.exit'), { variant: 'danger', onClick: () => { m.close(); api.toTable() } })
    ]
  })
}
