// A Mister White match, played around the table: the table stays at the top,
// the drawer below says what to do now.
//   start -> deal -> play <-> vote -> results
import { el, button, modal } from '../../shared/ui.js'
import { avatar, openProfileEditor } from '../../hub/players.js'
import {
  ROLE, roleLabel, suggestCounts, validateSetup,
  buildRound, checkWinner, guessMatches
} from './engine.js'
import packs from './packs.js'

const COUNTS_KEY = 'mister-white:counts'

function loadCounts(ctx, n) {
  const c = ctx.storage.get(COUNTS_KEY, null)
  if (c && validateSetup(n, c).ok) return { mrwhite: c.mrwhite, undercover: c.undercover }
  return suggestCounts(n)
}

const page = (children, cls = '') => el('div', { class: 'drawer-page' + (cls ? ' ' + cls : '') }, children)
const count = (big, small) => el('div', { class: 'table-count' }, [el('b', {}, big), el('span', {}, small)])
const pickRow = (list, onPick) => el('div', { class: 'pick-row' }, list.map(p =>
  el('button', { class: 'pick', onclick: () => onPick(p) }, [avatar(p, 48), el('span', { class: 'pick-name' }, p.name)])))

// The round's seats as table items; `look(player, i)` adds cls / note.
function seatItems(api, look) {
  const roster = new Map(api.ctx.players.all().map(p => [p.id, p]))
  return api.state.round.players.map((pl, i) => ({
    key: pl.seat || 'seat-' + i,
    p: pl.pid ? roster.get(pl.pid) || null : null,
    name: pl.name || 'libero',
    ...look(pl, i)
  }))
}

// ---------- before the match: this game's knobs in the hub's table drawer ----------
// Role counts follow the number of seats until you touch them.
export function tableOptions(ctx, onChange) {
  let n = 0
  let counts = null
  let touched = false

  function row(label, key) {
    const val = el('span', { class: 'stepper-val' })
    const bump = d => {
      counts[key] = Math.max(0, Math.min(5, counts[key] + d))
      touched = true
      ctx.storage.set(COUNTS_KEY, counts)
      onChange()
    }
    const node = el('div', { class: 'opt-row' }, [
      el('span', { class: 'opt-label' }, label),
      el('div', { class: 'stepper-ctrl' }, [
        el('button', { class: 'round-btn sm', 'aria-label': 'Meno', onclick: () => bump(-1) }, '−'),
        val,
        el('button', { class: 'round-btn sm', 'aria-label': 'Più', onclick: () => bump(1) }, '+')
      ])
    ])
    return { node, paint: () => { val.textContent = String(counts[key]) } }
  }

  const mw = row('Mister White', 'mrwhite')
  const uc = row('Undercover', 'undercover')
  const words = el('span', { class: 'opt-value' })
  const node = el('div', { class: 'opt-list' }, [
    mw.node, uc.node,
    el('div', { class: 'opt-row' }, [el('span', { class: 'opt-label' }, 'Parole'), words])
  ])

  return {
    node,
    // -> '' when a match can start with `seatCount` seats, else why not
    check(seatCount) {
      if (seatCount !== n) {
        if (!counts) counts = loadCounts(ctx, seatCount) // last used, if it still fits
        else if (!touched) counts = suggestCounts(seatCount)
        n = seatCount
        ctx.storage.set(COUNTS_KEY, counts)
      }
      mw.paint(); uc.paint()
      const pairs = packs.enabledItems().length
      words.textContent = pairs ? `${pairs} coppie` : 'nessun pacchetto attivo'
      const v = validateSetup(n, counts)
      if (!v.ok) return v.message.replace(/\.$/, '')
      if (!pairs) return 'Attiva un pacchetto di parole'
      return ''
    }
  }
}

// ---------- start: the table's people, roles dealt ----------
export function start(api) {
  const { ctx, state } = api
  const roster = new Map(ctx.players.all().map(p => [p.id, p]))
  const people = ctx.table.seats().map(s => {
    const p = s.pid ? roster.get(s.pid) : null
    return { name: p ? p.name : null, pid: p ? p.id : null, seat: s.id }
  })
  const counts = loadCounts(ctx, people.length)
  const pairs = packs.enabledItems()
  if (!validateSetup(people.length, counts).ok || !pairs.length) { api.toTable(); return }
  const pair = pairs[Math.floor(Math.random() * pairs.length)]
  Object.assign(state, {
    round: buildRound(people, pair, counts),
    dealIndex: 0, revealed: false, winner: null, mrWhiteGuess: null, recorded: false, lastOut: null
  })
  api.goPhase('deal')
}

// ---------- deal: the phone goes round, one word each ----------
export function deal(api, stage) {
  const { state } = api
  const players = state.round.players
  const i = state.dealIndex
  const me = players[i]
  stage.view.set(seatItems(api, (pl, k) => ({ cls: k === i ? 'on' : 'dim' })))
  stage.view.setCenter(count(`${i + 1}/${players.length}`, 'parole'))

  if (!me.pid) { stage.present(joinPage(api, me)); return }

  const next = () => {
    state.revealed = false
    if (i < players.length - 1) { state.dealIndex++; api.render() } else api.goPhase('play')
  }
  if (!state.revealed) {
    stage.present(page([
      el('p', { class: 'drawer-kicker' }, 'Passa il telefono a'),
      el('div', { class: 'drawer-name' }, me.name),
      el('p', { class: 'drawer-hint' }, 'Solo tu devi vedere lo schermo.'),
      button('Vedi la tua parola', { variant: 'primary', full: true, onClick: () => { state.revealed = true; api.render() } })
    ], 'steady'))
  } else {
    const last = i === players.length - 1
    stage.present(page([
      ...(me.role === ROLE.MRWHITE
        ? [el('div', { class: 'drawer-word mrwhite' }, 'Sei Mister White'),
          el('p', { class: 'drawer-hint' }, 'Non conosci la parola: fingi di saperla.')]
        : [el('p', { class: 'drawer-kicker' }, 'La tua parola è'),
          el('div', { class: 'drawer-word' }, me.word)]),
      button(last ? 'Nascondi e iniziate' : 'Nascondi e passa', { variant: 'secondary', full: true, onClick: next })
    ], 'steady'))
  }
}

// An empty chair: whoever got the phone here says who they are first, then
// sees their word. The table keeps them in that seat for next time.
function joinPage(api, me) {
  const { ctx, state } = api
  const seated = new Set(state.round.players.map(p => p.pid).filter(Boolean))
  const free = ctx.players.all().filter(p => !seated.has(p.id))
  const claim = p => {
    me.pid = p.id
    me.name = p.name
    ctx.table.sit(me.seat, p.id)
    api.render()
  }
  return page([
    el('p', { class: 'drawer-kicker' }, 'Posto libero'),
    el('div', { class: 'drawer-name' }, 'Chi sei?'),
    el('p', { class: 'drawer-hint' }, free.length
      ? 'Prima della parola, presentati: tocca il tuo profilo o creane uno.'
      : 'Prima della parola, crea il tuo profilo.'),
    free.length ? pickRow(free, claim) : null,
    button('Crea il mio profilo', {
      variant: 'primary', full: true,
      onClick: () => openProfileEditor(ctx, null, p => { if (p) claim(p) }, { title: 'Chi sei?' })
    })
  ])
}

// ---------- play: clues out loud, round the table ----------
export function play(api, stage) {
  const { state } = api
  const players = state.round.players
  const alive = players.filter(p => p.alive)
  const starter = state.round.order.map(i => players[i]).find(p => p.alive)
  stage.view.set(seatItems(api, pl => !pl.alive
    ? { cls: 'out', note: roleLabel(pl.role) }
    : pl === starter ? { cls: 'on', note: 'inizia' } : {}))
  stage.view.setCenter(count(String(alive.length), 'in gioco'))
  const out = state.lastOut
  stage.present(page([
    out ? el('p', { class: 'drawer-kicker' }, `${out.name} era ${roleLabel(out.role)}`) : null,
    el('div', { class: 'drawer-title' }, 'Indizi'),
    el('p', { class: 'drawer-hint' },
      `Inizia ${starter.name}, poi in senso orario: ognuno dice a voce una parola collegata alla propria.`),
    button('Vai alla votazione', { variant: 'primary', full: true, onClick: () => api.goPhase('vote') })
  ], 'steady'))
}

// ---------- vote: tap on the table who goes ----------
export function vote(api, stage) {
  const { state } = api
  const players = state.round.players
  let chosen = null

  function paint() {
    stage.view.set(seatItems(api, (pl, i) => !pl.alive
      ? { cls: 'out', note: roleLabel(pl.role) }
      : { cls: chosen === i ? 'on' : chosen != null ? 'dim' : '' }))
    stage.present(chosen == null
      ? page([
        el('div', { class: 'drawer-title' }, 'Votazione'),
        el('p', { class: 'drawer-hint' }, 'Discutete e votate, poi toccate sul tavolo chi eliminare.'),
        button('Torna agli indizi', { variant: 'ghost', full: true, onClick: () => api.goPhase('play') })
      ], 'steady')
      : page([
        el('p', { class: 'drawer-kicker' }, 'Eliminare'),
        el('div', { class: 'drawer-name' }, players[chosen].name + '?'),
        el('div', { class: 'drawer-row' }, [
          button('Annulla', { variant: 'ghost', onClick: () => { chosen = null; paint() } }),
          button('Elimina', { variant: 'danger', onClick: () => eliminate(players[chosen]) })
        ])
      ], 'steady'))
  }

  api.onSeat = i => {
    if (!players[i] || !players[i].alive) return
    chosen = chosen === i ? null : i
    paint()
  }
  stage.view.setCenter(count(String(players.filter(p => p.alive).length), 'in gioco'))
  paint()

  function eliminate(p) {
    if (p.role === ROLE.MRWHITE) askGuess(p)
    else { p.alive = false; afterElimination(p) }
  }

  function askGuess(p) {
    const input = el('input', { class: 'text-input', type: 'text', placeholder: 'La parola dei civili è…' })
    const m = modal({
      title: `${p.name} è Mister White!`,
      content: [el('p', {}, 'Ultima possibilità: indovina la parola dei civili per vincere.'), input],
      actions: [
        button('Non indovina', { variant: 'ghost', onClick: () => { m.close(); p.alive = false; afterElimination(p) } }),
        button('Conferma', {
          variant: 'primary',
          onClick: () => {
            const correct = guessMatches(input.value, state.round.pair.civilian)
            m.close()
            p.alive = false
            state.mrWhiteGuess = { name: p.name, correct }
            if (correct) { state.winner = 'mrwhite-guess'; api.goPhase('results') } else afterElimination(p)
          }
        })
      ]
    })
    input.focus()
  }

  // The news goes in the next drawer ("Anna era Civile"), not in a toast.
  function afterElimination(p) {
    state.lastOut = p
    const w = checkWinner(players)
    if (w) { state.winner = w; api.goPhase('results') } else api.goPhase('play')
  }
}

// Who won, as round players.
function winners(state) {
  const players = state.round.players
  if (state.winner === 'civili') return players.filter(p => p.role === ROLE.CIVILE)
  if (state.winner === 'mrwhite-guess') return players.filter(p => p.role === ROLE.MRWHITE)
  return players.filter(p => p.role !== ROLE.CIVILE) // impostori
}

// ---------- results: every role shown at its seat ----------
export function results(api, stage) {
  const { ctx, state } = api
  const players = state.round.players
  const won = new Set(winners(state))

  // Record stats once per finished round.
  if (!state.recorded) {
    state.recorded = true
    const pids = players.map(p => p.pid).filter(Boolean)
    const wins = [...won].map(p => p.pid).filter(Boolean)
    const result = state.winner === 'civili' ? 'Vittoria Civili'
      : state.winner === 'mrwhite-guess' ? 'Mister White ha indovinato'
        : 'Vittoria Impostori'
    if (pids.length) ctx.stats.record('mister-white', pids, wins, { result })
  }

  const [headline, sub] = state.winner === 'civili'
    ? ['Vincono i Civili', 'Tutti gli impostori sono stati smascherati.']
    : state.winner === 'mrwhite-guess'
      ? ['Vince Mister White', `${state.mrWhiteGuess.name} ha indovinato la parola.`]
      : ['Vincono gli Impostori', 'Sono sopravvissuti fino alla fine.']

  stage.view.set(seatItems(api, pl => ({ cls: (won.has(pl) ? 'on' : 'dim') + ' role-' + pl.role, note: roleLabel(pl.role) })))
  stage.view.setCenter(null)
  const { civilian, undercover } = state.round.pair
  const hadUndercover = players.some(p => p.role === ROLE.UNDERCOVER)
  stage.present(page([
    el('div', { class: 'drawer-title' }, headline),
    el('p', { class: 'drawer-hint' }, sub),
    el('div', { class: 'drawer-words' }, [
      el('div', {}, [el('span', {}, 'Civili'), el('b', {}, civilian)]),
      hadUndercover ? el('div', {}, [el('span', {}, 'Undercover'), el('b', {}, undercover)]) : null
    ]),
    button('Rigioca', { variant: 'primary', full: true, onClick: () => api.goPhase('start') }),
    el('div', { class: 'drawer-row' }, [
      button('Cambia tavolo', { variant: 'secondary', onClick: () => api.toTable() }),
      button('Menu', { variant: 'ghost', onClick: () => api.toMenu() })
    ])
  ]))
}

// Back from the match: free before anyone has seen a word; afterwards it
// would throw the round away, so ask first.
export function leave(api) {
  const { state } = api
  const midRound = state.round && state.phase !== 'results' &&
    (state.phase !== 'deal' || state.dealIndex > 0 || state.revealed)
  if (!midRound) { api.toTable(); return }
  const m = modal({
    title: 'Uscire dalla partita?',
    content: [el('p', { class: 'muted' }, 'Il round in corso andrà perso.')],
    actions: [
      button('Resta', { variant: 'ghost', onClick: () => m.close() }),
      button('Esci', { variant: 'danger', onClick: () => { m.close(); api.toTable() } })
    ]
  })
}
