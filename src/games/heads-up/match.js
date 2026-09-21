// Heads Up at the table: teams, turns, the standings.
//
// A turn is one team's: the phone goes to one of them, face out on the
// forehead, and the rest shout clues until the time runs out. Then it's the
// next team's turn. When everyone has had theirs, that's a round — one by
// default, and the standings come up with Rigioca right there, so another round
// costs one tap and nobody is committed to a long game up front.
//
// The phone-holder rotates inside the team: turn one is their first player,
// turn two the second. Nobody ends up holding it all evening.
import { el, icon, button, walls, shuffle } from '../../shared/ui.js'
import { t } from '../../shared/i18n.js'
import { ensurePermission } from './motion.js'
import * as teams from './teams.js'
import packs from './packs.js'

const OPTS_KEY = 'heads-up:options'
const DURATIONS = [30, 60, 90]
const ROUNDS = [1, 2, 3]

const page = (children, cls = '') => el('div', { class: 'drawer-page' + (cls ? ' ' + cls : '') }, children)
const count = (big, small) => el('div', { class: 'table-count' }, [el('b', {}, big), el('span', {}, small)])

export const teamName = i => t('hu.team.n', { n: i + 1 })

export function loadOptions(ctx) {
  const raw = ctx.storage.get(OPTS_KEY, null) || {}
  return {
    packId: typeof raw.packId === 'string' ? raw.packId : null,
    duration: DURATIONS.includes(raw.duration) ? raw.duration : 60,
    rounds: ROUNDS.includes(raw.rounds) ? raw.rounds : 1,
    invert: !!raw.invert
  }
}
const saveOptions = (ctx, o) => ctx.storage.set(OPTS_KEY, o)

// The category this match draws from: the one you chose, while it's still
// there, otherwise the first one on. Resolved late, because the categories
// arrive from the database and may not exist yet when the drawer is built.
function currentPack(ctx) {
  const o = loadOptions(ctx)
  const on = packs.enabledPacks()
  return (o.packId && on.find(p => p.id === o.packId)) || on[0] || null
}

// ---------- the drawer: Squadre / Categoria / Durata / Comandi ----------
export function tableOptions(ctx, ui) {
  let seats = []
  let paintPage = null

  function door(label, onClick) {
    const value = el('span', { class: 'opt-value' })
    const node = el('button', { class: 'opt-row opt-door', onclick: onClick }, [
      el('span', { class: 'opt-label' }, label),
      el('span', { class: 'opt-door-value' }, [value, icon('forward')])
    ])
    return { node, set: text => { value.textContent = text } }
  }

  const teamsDoor = door(t('hu.opt.teams'), () => openTeams())
  const wordsDoor = door(t('hu.opt.words'), () => openWords())
  const roundDoor = door(t('hu.opt.round'), () => openRound())
  const node = el('div', { class: 'opt-list' }, [teamsDoor.node, wordsDoor.node, roundDoor.node])

  // "2 squadre · 3 e 3" — the split, not just how many.
  function teamsSummary() {
    const per = teams.sizes(seats)
    return t('hu.opt.teamsSummary', { n: per.length, split: per.join(' · ') })
  }

  function wordsSummary() {
    // The categories arrive with the first network the app sees. Until then the
    // list is empty through nobody's choice, and "pick one" is the wrong advice.
    if (packs.remote && !packs.remote.has()) return t('hu.setup.wordsMissing')
    const p = currentPack(ctx)
    return p ? `${p.name} · ${p.items.length}` : t('hu.opt.noCategory')
  }

  function roundSummary() {
    const o = loadOptions(ctx)
    return t('hu.opt.roundSummary', { s: o.duration, n: o.rounds })
  }

  // ---------- Squadre: how many, and who's on which ----------
  function openTeams() {
    const list = walls(el('div', { class: 'pack-pick-list list-scroll' }))
    const steps = el('div', { class: 'chip-list' })

    paintPage = () => {
      steps.replaceChildren(...Array.from({ length: teams.MAX_TEAMS - teams.MIN_TEAMS + 1 }, (_, k) => {
        const n = teams.MIN_TEAMS + k
        return el('button', {
          class: 'chip selectable' + (teams.count() === n ? ' on' : ''),
          onclick: () => { teams.setCount(n); ui.changed() }
        }, t('hu.opt.nTeams', { n }))
      }))

      const roster = new Map(ctx.players.all().map(p => [p.id, p]))
      const of = teams.assign(seats)
      const rows = seats.filter(s => s.pid && roster.get(s.pid)).map(seat => {
        const player = roster.get(seat.pid)
        const team = of.get(seat.id)
        return el('button', {
          class: 'pack-pick team-pick team-' + team,
          onclick: () => { teams.cycle(seats, seat.id); ui.changed() }
        }, [
          el('span', { class: 'team-dot' }),
          el('span', { class: 'pack-text' }, [
            el('span', { class: 'pack-name' }, player.name),
            el('span', { class: 'pack-count' }, teamName(team))
          ])
        ])
      })
      list.replaceChildren(...(rows.length ? rows : [el('p', { class: 'drawer-hint' }, t('hu.opt.noPlayers'))]))
    }

    paintPage()
    ui.open(t('hu.opt.teams'), [
      el('p', { class: 'drawer-hint' }, t('hu.opt.teamsHint')),
      steps,
      list,
      button(t('hu.opt.teamsReset'), { variant: 'ghost', full: true, onClick: () => { teams.reset(); ui.changed() } })
    ])
  }

  // ---------- Categoria: one at a time, because it IS the game ----------
  function openWords() {
    const list = walls(el('div', { class: 'pack-pick-list list-scroll' }))
    paintPage = () => {
      const on = packs.enabledPacks()
      const chosen = currentPack(ctx)
      if (!on.length) {
        list.replaceChildren(el('p', { class: 'drawer-hint' },
          t(packs.remote && !packs.remote.has() ? 'hu.setup.wordsMissing' : 'hu.setup.noCategory')))
        return
      }
      list.replaceChildren(...on.map(p => el('button', {
        class: 'pack-pick' + (chosen && chosen.id === p.id ? ' on' : ''),
        'aria-pressed': chosen && chosen.id === p.id ? 'true' : 'false',
        onclick: () => { saveOptions(ctx, { ...loadOptions(ctx), packId: p.id }); ui.changed() }
      }, [
        el('span', { class: 'pack-pick-check' }, icon('check')),
        el('span', { class: 'pack-text' }, [
          el('span', { class: 'pack-name' }, p.name),
          el('span', { class: 'pack-count' }, `${p.items.length} ${packs.unit}`)
        ])
      ])))
    }
    paintPage()
    ui.open(t('hu.opt.words'), [el('p', { class: 'drawer-hint' }, t('hu.opt.wordsHint')), list])
  }

  // ---------- Il giro: how long a turn is, how many turns each ----------
  function openRound() {
    const durations = el('div', { class: 'chip-list' })
    const rounds = el('div', { class: 'chip-list' })
    const invert = el('button', { class: 'switch', role: 'switch', 'aria-label': t('hu.setup.invert') }, el('span', { class: 'switch-knob' }))
    invert.addEventListener('click', () => {
      saveOptions(ctx, { ...loadOptions(ctx), invert: !loadOptions(ctx).invert })
      ui.changed()
    })

    paintPage = () => {
      const o = loadOptions(ctx)
      durations.replaceChildren(...DURATIONS.map(d => el('button', {
        class: 'chip selectable' + (o.duration === d ? ' on' : ''),
        onclick: () => { saveOptions(ctx, { ...loadOptions(ctx), duration: d }); ui.changed() }
      }, `${d}s`)))
      rounds.replaceChildren(...ROUNDS.map(n => el('button', {
        class: 'chip selectable' + (o.rounds === n ? ' on' : ''),
        onclick: () => { saveOptions(ctx, { ...loadOptions(ctx), rounds: n }); ui.changed() }
      }, t('hu.opt.nRounds', { n }))))
      invert.classList.toggle('on', o.invert)
      invert.setAttribute('aria-checked', String(o.invert))
    }

    paintPage()
    ui.open(t('hu.opt.round'), [
      el('h2', { class: 'role-section' }, t('hu.setup.duration')),
      durations,
      el('h2', { class: 'role-section' }, t('hu.opt.rounds')),
      rounds,
      el('p', { class: 'drawer-hint' }, t('hu.opt.roundsHint')),
      el('h2', { class: 'role-section' }, t('hu.setup.controls')),
      el('p', { class: 'drawer-hint' }, t('hu.setup.tiltHint')),
      el('div', { class: 'role-row' }, [
        el('div', { class: 'role-head' }, [el('span', { class: 'role-name' }, t('hu.setup.invert')), invert])
      ])
    ])
  }

  return {
    node,
    // -> '' when a match can start, else why not
    check(seatCount) {
      seats = ctx.table.seats()
      teamsDoor.set(teamsSummary())
      wordsDoor.set(wordsSummary())
      roundDoor.set(roundSummary())
      if (paintPage) paintPage()
      const missing = teams.short(seats)
      if (missing.length) {
        return missing.length === 1
          ? t('hu.setup.teamShort', { team: teamName(missing[0]), n: teams.MIN_PER_TEAM })
          : t('hu.setup.teamsShort', { n: teams.MIN_PER_TEAM })
      }
      if (!currentPack(ctx)) return t('hu.setup.pickCategory')
      return ''
    }
  }
}

// ---------- start: the teams, the words, the order of turns ----------
export function start(api) {
  const { ctx, state } = api
  const seats = ctx.table.seats()
  const lists = teams.rosters(seats, ctx.players.all())
  const pack = currentPack(ctx)
  if (teams.short(seats).length || !pack) { api.toTable(); return }

  const o = loadOptions(ctx)
  // One shuffled pool for the whole match, walked straight through: two teams
  // never get the same word, which they would if each turn shuffled its own.
  Object.assign(state, {
    teams: lists.map((players, i) => ({ i, name: teamName(i), players, score: 0 })),
    packName: pack.name,
    words: shuffle(pack.items.slice()),
    cursor: 0,
    duration: o.duration,
    rounds: o.rounds,
    invert: o.invert,
    turn: 0,            // which turn of the match we're on, 0-based
    results: [],        // this turn's { word, correct }
    recorded: false
  })
  api.goPhase('turn')
}

// Whose turn it is, and who holds the phone for it.
export function whoseTurn(state) {
  const team = state.teams[state.turn % state.teams.length]
  const round = Math.floor(state.turn / state.teams.length)
  const holder = team.players[round % team.players.length]
  return { team, holder, round }
}

const totalTurns = state => state.teams.length * state.rounds

// The seats as table items, the team's own lit and the phone-holder marked.
function seatItems(api, { lit, holder } = {}) {
  const roster = new Map(api.ctx.players.all().map(p => [p.id, p]))
  const of = teams.assign(api.ctx.table.seats())
  return api.ctx.table.seats().map((seat, i) => {
    const player = seat.pid ? roster.get(seat.pid) || null : null
    const team = of.get(seat.id)
    const mine = lit == null || team === lit
    const isHolder = holder && player && player.id === holder.id
    return {
      key: seat.id || 'seat-' + i,
      p: player,
      name: player ? player.name : t('table.free'),
      note: isHolder ? t('hu.turn.holder') : (team != null ? teamName(team) : ''),
      cls: (team != null ? 'team-' + team : '') + (mine ? '' : ' dim') + (isHolder ? ' on' : '')
    }
  })
}

const scoreLine = state => state.teams.map(tm => `${tm.name} ${tm.score}`).join('  ·  ')

// ---------- turn: hand the phone over ----------
export function turn(api, stage) {
  const { state } = api
  const { team, holder, round } = whoseTurn(state)

  stage.view.set(seatItems(api, { lit: team.i, holder }))
  stage.view.setCenter(count(String(state.turn + 1), t('hu.turn.of', { n: totalTurns(state) })))

  stage.present(page([
    el('div', { class: 'drawer-title team-' + team.i }, t('hu.turn.title', { team: team.name })),
    el('p', { class: 'drawer-hint' }, t('hu.turn.hint', { name: holder.name })),
    state.rounds > 1 ? el('p', { class: 'drawer-hint' }, t('hu.turn.round', { n: round + 1, of: state.rounds })) : null,
    el('p', { class: 'drawer-hint' }, `${state.packName} · ${scoreLine(state)}`),
    // iOS only hands out the motion sensor from inside the tap that asks for
    // it, so the asking happens here and not a screen later.
    button(t('hu.ready.start'), {
      variant: 'primary', full: true,
      onClick: async () => {
        state.motionGranted = await ensurePermission()
        api.goPhase('countdown')
      }
    })
  ]))
}

// ---------- tally: the turn is over ----------
export function tally(api, stage) {
  const { state } = api
  const { team } = whoseTurn(state)
  const got = state.results.filter(r => r.correct)
  const passed = state.results.filter(r => !r.correct)

  stage.view.set(seatItems(api, { lit: team.i }))
  stage.view.setCenter(count(String(got.length), got.length === 1 ? t('hu.tally.point') : t('hu.tally.points')))

  const chips = list => {
    const box = el('div', { class: 'chip-list' })
    for (const r of list) box.append(el('span', { class: 'chip result-chip ' + (r.correct ? 'ok' : 'pass') }, r.word))
    return box
  }

  const last = state.turn + 1 >= totalTurns(state)
  stage.present(page([
    el('div', { class: 'drawer-title team-' + team.i }, t('hu.tally.title', { team: team.name })),
    el('p', { class: 'drawer-hint' }, scoreLine(state)),
    walls(el('div', { class: 'list-scroll' }, [
      got.length ? chips(got) : null,
      passed.length ? chips(passed) : null,
      state.results.length ? null : el('p', { class: 'drawer-hint' }, t('hu.results.empty'))
    ])),
    button(last ? t('hu.tally.standings') : t('hu.tally.next'), {
      variant: 'primary', full: true,
      onClick: () => {
        state.turn++
        state.results = []
        api.goPhase(last ? 'standings' : 'turn')
      }
    })
  ]))
}

// ---------- standings: who won, and one tap to go again ----------
export function standings(api, stage) {
  const { ctx, state } = api
  const best = Math.max(...state.teams.map(tm => tm.score))
  const won = state.teams.filter(tm => tm.score === best)
  const draw = won.length > 1

  // Written once: coming back to this screen (a redraw, a language change)
  // must not count the match twice.
  if (!state.recorded) {
    state.recorded = true
    const everyone = state.teams.flatMap(tm => tm.players).map(p => p.id)
    const winners = draw ? [] : won[0].players.map(p => p.id)
    if (everyone.length) {
      ctx.stats.record('heads-up', everyone, winners, {
        result: draw ? t('hu.standings.draw') : t('hu.standings.won', { team: won[0].name })
      })
    }
  }

  const winning = new Set(draw ? [] : won[0].players.map(p => p.id))
  const roster = new Map(ctx.players.all().map(p => [p.id, p]))
  const of = teams.assign(ctx.table.seats())
  stage.view.set(ctx.table.seats().map((seat, i) => {
    const player = seat.pid ? roster.get(seat.pid) || null : null
    const team = of.get(seat.id)
    const up = draw || (player && winning.has(player.id))
    return {
      key: seat.id || 'seat-' + i,
      p: player,
      name: player ? player.name : t('table.free'),
      note: team != null ? `${teamName(team)} · ${state.teams[team].score}` : '',
      cls: (team != null ? 'team-' + team : '') + (up ? '' : ' dim')
    }
  }))
  stage.view.setCenter(null)

  const order = [...state.teams].sort((a, b) => b.score - a.score)
  stage.present(page([
    el('div', { class: 'drawer-title' }, draw ? t('hu.standings.draw') : t('hu.standings.won', { team: won[0].name })),
    el('div', { class: 'score-list' }, order.map(tm => el('div', { class: 'score-row team-' + tm.i }, [
      el('span', { class: 'team-dot' }),
      el('span', { class: 'score-name' }, tm.name),
      el('span', { class: 'score-sub muted' }, tm.players.map(p => p.name).join(', ')),
      el('b', { class: 'score-value' }, String(tm.score))
    ]))),
    el('div', { class: 'row stack' }, [
      button(t('hu.standings.again'), { variant: 'primary', full: true, onClick: () => start(api) }),
      button(t('hu.standings.change'), { variant: 'secondary', full: true, onClick: () => api.toTable() })
    ])
  ]))
}

// Leaving mid-match: back to the table, nothing recorded.
export function leave(api) {
  api.stopRuntime()
  api.toTable()
}
