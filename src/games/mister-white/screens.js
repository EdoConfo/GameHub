import { el, screen, button, modal, toast, clear } from '../../shared/ui.js'
import { renderPackManager } from '../../shared/packManagerScreen.js'
import { avatar } from '../../hub/players.js'
import {
  ROLE, roleLabel, suggestCounts, validateSetup,
  buildRound, checkWinner, guessMatches
} from './engine.js'

// ---------- HOME (game menu, PS-app style) ----------
export function renderHome(api) {
  const { ctx, state } = api
  const view = screen({ title: 'Mister White', onBack: () => ctx.router.go('/') })

  view.body.append(el('div', { class: 'game-hero' }, [
    el('div', { class: 'game-hero-icon' }, '🕵️'),
    el('h1', { class: 'game-hero-title' }, 'Mister White'),
    el('p', { class: 'game-hero-tag' }, 'Trova l’impostore che non conosce la parola.')
  ]))

  const menu = el('div', { class: 'game-menu' }, [
    menuItem('Gioca', 'Nuova partita', () => api.goPhase('setup'), true),
    menuItem('Parole', 'Pacchetti e coppie', () => api.goPhase('packs')),
    menuItem('Come si gioca', 'Regole e ruoli', () => api.goPhase('rules')),
    menuItem('Statistiche', 'Partite e vittorie', () => api.goPhase('stats'))
  ])
  view.body.append(menu)
  return view
}

function menuItem(title, sub, onClick, primary) {
  return el('button', { class: 'game-menu-item' + (primary ? ' primary' : ''), onclick: onClick }, [
    el('span', { class: 'game-menu-text' }, [
      el('span', { class: 'game-menu-title' }, title),
      el('span', { class: 'game-menu-sub' }, sub)
    ]),
    el('span', { class: 'game-menu-arrow', 'aria-hidden': 'true' }, '›')
  ])
}

// ---------- SETUP ----------
export function renderSetup(api) {
  const { ctx, state } = api
  const view = screen({ title: 'Nuova partita', onBack: () => api.goPhase('home') })

  // --- Players (from the shared roster) ---
  const sec1 = section('Chi gioca?')
  const chips = el('div', { class: 'chip-list' })
  const selected = new Set(state.selectedIds)

  function refreshChips() {
    clear(chips)
    const roster = ctx.players.all()
    if (!roster.length) {
      chips.append(el('p', { class: 'muted' }, 'Nessun giocatore. Aggiungine uno qui sotto o dall’icona 👥.'))
    }
    for (const p of roster) {
      const on = selected.has(p.id)
      chips.append(el('button', {
        class: 'chip selectable player-chip' + (on ? ' on' : ''),
        onclick: () => {
          if (on) selected.delete(p.id); else selected.add(p.id)
          state.selectedIds = [...selected]
          refreshChips(); refreshValidity()
        }
      }, [avatar(p, 22), el('span', {}, p.name)]))
    }
  }

  const nameInput = el('input', { class: 'text-input', type: 'text', placeholder: 'Nuovo giocatore…', maxlength: '20' })
  function addPlayer() {
    const v = nameInput.value.trim()
    if (!v) return
    const p = ctx.players.add({ name: v })
    if (p) { selected.add(p.id); state.selectedIds = [...selected] }
    nameInput.value = ''
    refreshChips(); refreshValidity()
  }
  nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') addPlayer() })

  sec1.append(chips)
  sec1.append(el('div', { class: 'row' }, [nameInput, button('Aggiungi', { variant: 'secondary', onClick: addPlayer })]))

  // --- Roles ---
  const sec2 = section('Ruoli')
  const mrWhiteStep = stepper('Mister White', () => state.counts.mrwhite, v => { state.counts.mrwhite = v; refreshValidity() }, 0, 5)
  const underStep = stepper('Undercover', () => state.counts.undercover, v => { state.counts.undercover = v; refreshValidity() }, 0, 5)
  sec2.append(mrWhiteStep.node, underStep.node)
  sec2.append(el('button', {
    class: 'link-btn',
    onclick: () => {
      state.counts = suggestCounts(selected.size)
      mrWhiteStep.refresh(); underStep.refresh(); refreshValidity()
    }
  }, 'Usa valori consigliati'))

  // --- Packs summary ---
  const sec3 = section('Parole')
  const packInfo = el('p', { class: 'muted' })
  sec3.append(packInfo)
  sec3.append(el('button', { class: 'link-btn', onclick: () => api.goPhase('packs') }, 'Gestisci parole'))

  // --- Validation + start ---
  const errBox = el('p', { class: 'error-text' })
  const startBtn = button('Distribuisci', { variant: 'primary', full: true, onClick: startRound })

  function refreshValidity() {
    const n = selected.size
    const pairs = api.packs.enabledItems()
    packInfo.textContent = pairs.length
      ? `${pairs.length} coppie disponibili dai pacchetti attivi.`
      : 'Nessun pacchetto attivo: attivane uno in “Gestisci parole”.'
    const setup = validateSetup(n, state.counts)
    let msg = ''
    if (!setup.ok) msg = setup.message
    else if (!pairs.length) msg = 'Attiva almeno un pacchetto di parole.'
    errBox.textContent = msg
    startBtn.disabled = !!msg
  }

  function startRound() {
    const people = [...selected].map(id => {
      const p = ctx.players.get(id)
      return { name: p ? p.name : '???', pid: id }
    })
    const pairs = api.packs.enabledItems()
    if (!pairs.length) return
    const pair = pairs[Math.floor(Math.random() * pairs.length)]
    state.round = buildRound(people, pair, { ...state.counts })
    state.dealIndex = 0
    state.revealed = false
    state.winner = null
    state.mrWhiteGuess = null
    state.recorded = false
    api.goPhase('deal')
  }

  view.body.append(sec1, sec2, sec3, errBox, startBtn)
  refreshChips(); refreshValidity()
  return view
}

// ---------- PACKS (manage words for this game) ----------
export function renderPacks(api) {
  return renderPackManager(api.packs, {
    title: 'Parole',
    help: 'Coppie di parole (una segreta, una simile). Attiva i pacchetti da usare; puoi aggiungerne di tuoi.',
    onBack: () => api.goPhase('setup')
  })
}

// ---------- DEAL ----------
export function renderDeal(api) {
  const { state } = api
  const view = screen({ title: 'Distribuzione', onBack: () => api.goPhase('setup') })
  const players = state.round.players
  const p = players[state.dealIndex]

  const counter = el('p', { class: 'muted center' }, `Giocatore ${state.dealIndex + 1} di ${players.length}`)

  const card = el('button', { class: 'reveal-card' })
  function paintCard() {
    clear(card)
    if (!state.revealed) {
      card.classList.remove('open')
      card.append(
        el('span', { class: 'reveal-name' }, p.name),
        el('span', { class: 'reveal-hint' }, 'Tocca per vedere la tua parola')
      )
    } else {
      card.classList.add('open')
      if (p.role === ROLE.MRWHITE) {
        card.append(
          el('span', { class: 'reveal-role mrwhite' }, 'Sei Mister White'),
          el('span', { class: 'reveal-hint' }, 'Non conosci la parola. Fingi di saperla!')
        )
      } else {
        card.append(
          el('span', { class: 'reveal-hint' }, 'La tua parola è'),
          el('span', { class: 'reveal-word' }, p.word)
        )
      }
      card.append(el('span', { class: 'reveal-hint dim' }, 'Tocca di nuovo per nascondere'))
    }
  }
  card.addEventListener('click', () => {
    if (!state.revealed) { state.revealed = true; paintCard() }
    else advance()
  })

  function advance() {
    state.revealed = false
    if (state.dealIndex < players.length - 1) {
      state.dealIndex++
      api.render()
    } else {
      api.goPhase('play')
    }
  }

  paintCard()
  view.body.append(counter, card)
  view.body.append(el('p', { class: 'muted center small' }, 'Passa il telefono al giocatore indicato senza far vedere lo schermo agli altri.'))
  return view
}

// ---------- PLAY ----------
export function renderPlay(api) {
  const { state } = api
  const view = screen({ title: 'Round', onBack: () => api.goPhase('setup') })
  const players = state.round.players
  const alive = players.filter(p => p.alive)

  view.body.append(el('p', { class: 'lead center' }, 'A turno, ognuno dice una parola collegata alla propria. A voce, non sul telefono.'))

  const orderList = el('ol', { class: 'turn-order' })
  // Show alive players in the seating order starting from the random start.
  const aliveInOrder = state.round.order.map(i => players[i]).filter(p => p.alive)
  aliveInOrder.forEach((p, i) => {
    orderList.append(el('li', { class: i === 0 ? 'first' : '' }, [
      p.name,
      i === 0 ? el('span', { class: 'badge' }, 'inizia') : null
    ]))
  })
  view.body.append(section('Ordine dei turni', [orderList]))

  view.body.append(el('p', { class: 'muted center' }, `${alive.length} giocatori ancora in gioco.`))
  view.body.append(button('Vai alla votazione', { variant: 'primary', full: true, onClick: () => api.goPhase('vote') }))
  return view
}

// ---------- VOTE ----------
export function renderVote(api) {
  const { state } = api
  const view = screen({ title: 'Votazione', onBack: () => api.goPhase('play') })
  const players = state.round.players

  view.body.append(el('p', { class: 'lead center' }, 'Votate insieme. Chi eliminate?'))

  const list = el('div', { class: 'vote-list' })
  for (const p of players) {
    if (!p.alive) {
      list.append(el('div', { class: 'vote-row out' }, [
        el('span', {}, p.name),
        el('span', { class: 'role-tag ' + p.role }, roleLabel(p.role))
      ]))
    } else {
      list.append(el('button', {
        class: 'vote-row',
        onclick: () => eliminate(p)
      }, [el('span', {}, p.name), el('span', { class: 'vote-hint' }, 'elimina')]))
    }
  }
  view.body.append(list)

  function eliminate(p) {
    if (p.role === ROLE.MRWHITE) {
      askGuess(p)
    } else {
      p.alive = false
      afterElimination(p)
    }
  }

  function askGuess(p) {
    const input = el('input', { class: 'text-input', type: 'text', placeholder: 'La parola dei civili è…' })
    const m = modal({
      title: `${p.name} è Mister White!`,
      content: [
        el('p', {}, 'Ultima possibilità: indovina la parola dei civili per vincere.'),
        input
      ],
      actions: [
        button('Non indovina', { variant: 'ghost', onClick: () => { m.close(); p.alive = false; afterElimination(p) } }),
        button('Conferma', {
          variant: 'primary',
          onClick: () => {
            const correct = guessMatches(input.value, state.round.pair.civilian)
            m.close()
            p.alive = false
            state.mrWhiteGuess = { name: p.name, correct }
            if (correct) {
              state.winner = 'mrwhite-guess'
              api.goPhase('results')
            } else {
              afterElimination(p)
            }
          }
        })
      ]
    })
    input.focus()
  }

  function afterElimination(p) {
    toast(`${p.name} era ${roleLabel(p.role)}`)
    const w = checkWinner(players)
    if (w) { state.winner = w; api.goPhase('results') }
    else api.goPhase('play')
  }

  return view
}

// Which players won, given the outcome (used for stats).
function winnerPids(state) {
  const players = state.round.players
  if (state.winner === 'civili') return players.filter(p => p.role === ROLE.CIVILE).map(p => p.pid)
  if (state.winner === 'mrwhite-guess') return players.filter(p => p.role === ROLE.MRWHITE).map(p => p.pid)
  return players.filter(p => p.role !== ROLE.CIVILE).map(p => p.pid) // impostori
}

// ---------- RESULTS ----------
export function renderResults(api) {
  const { ctx, state } = api
  const view = screen({ title: 'Risultato', onBack: () => api.goPhase('home') })
  const players = state.round.players

  // Record stats once per finished round.
  if (!state.recorded) {
    state.recorded = true
    const playerPids = players.map(p => p.pid).filter(Boolean)
    const wins = winnerPids(state).filter(Boolean)
    if (playerPids.length) ctx.stats.record('mister-white', playerPids, wins)
  }

  let headline, sub
  if (state.winner === 'civili') {
    headline = '🎉 Vincono i Civili!'
    sub = 'Tutti gli impostori sono stati smascherati.'
  } else if (state.winner === 'mrwhite-guess') {
    headline = '🕵️ Vince Mister White!'
    sub = `${state.mrWhiteGuess.name} ha indovinato la parola dei civili.`
  } else {
    headline = '😈 Vincono gli Impostori!'
    sub = 'Sono sopravvissuti fino alla fine.'
  }

  view.body.append(el('div', { class: 'result-hero' }, [
    el('h2', { class: 'result-headline' }, headline),
    el('p', { class: 'muted center' }, sub)
  ]))

  view.body.append(section('Le parole', [
    el('div', { class: 'word-reveal' }, [
      el('div', {}, [el('span', { class: 'muted' }, 'Civili: '), el('strong', {}, state.round.pair.civilian)]),
      el('div', {}, [el('span', { class: 'muted' }, 'Undercover: '), el('strong', {}, state.round.pair.undercover)])
    ])
  ]))

  const roster = el('div', { class: 'result-roster' })
  for (const p of players) {
    roster.append(el('div', { class: 'result-row' }, [
      el('span', {}, p.name),
      el('span', { class: 'role-tag ' + p.role }, roleLabel(p.role)),
      el('span', { class: 'muted small' }, p.alive ? 'sopravvissuto' : 'eliminato')
    ]))
  }
  view.body.append(section('Ruoli', [roster]))

  view.body.append(el('div', { class: 'row stack' }, [
    button('Rigioca (stessi giocatori)', {
      variant: 'primary', full: true, onClick: () => {
        const people = state.round.players.map(p => ({ name: p.name, pid: p.pid }))
        const pairs = api.packs.enabledItems()
        const pair = pairs[Math.floor(Math.random() * pairs.length)]
        state.round = buildRound(people, pair, { ...state.counts })
        state.dealIndex = 0; state.revealed = false
        state.winner = null; state.mrWhiteGuess = null; state.recorded = false
        api.goPhase('deal')
      }
    }),
    button('Torna al menu', { variant: 'ghost', full: true, onClick: () => api.goPhase('home') })
  ]))
  return view
}

// ---------- RULES ----------
export function renderRules(api) {
  const view = screen({ title: 'Come si gioca', onBack: () => api.goPhase('home') })
  const rule = (t, d) => el('div', { class: 'rule' }, [el('div', { class: 'rule-title' }, t), el('div', { class: 'rule-desc muted' }, d)])
  view.body.append(section('Ruoli', [
    rule('Civili', 'Ricevono la parola segreta.'),
    rule('Undercover', 'Ricevono una parola simile ma diversa.'),
    rule('Mister White', 'Non riceve nessuna parola: deve fingere di saperla.')
  ]))
  view.body.append(section('Come si svolge', [
    rule('1 · Distribuzione', 'Passa il telefono: ognuno vede in privato la sua parola (o scopre di essere Mister White).'),
    rule('2 · Indizi', 'A turno, ognuno dice a voce una parola collegata alla propria. Non scriverla.'),
    rule('3 · Votazione', 'Discutete ed eliminate un sospetto. Si scopre il suo ruolo.')
  ]))
  view.body.append(section('Chi vince', [
    rule('Civili', 'Se eliminano tutti gli impostori (Undercover + Mister White).'),
    rule('Impostori', 'Se sopravvivono fino a pareggiare i civili.'),
    rule('Mister White', 'Se, una volta eliminato, indovina la parola dei civili.')
  ]))
  return view
}

// ---------- STATS ----------
export function renderStats(api) {
  const { ctx } = api
  const view = screen({ title: 'Statistiche', onBack: () => api.goPhase('home') })
  const data = ctx.stats.get('mister-white')
  const rows = Object.entries(data)
    .map(([id, s]) => ({ p: ctx.players.get(id), ...s }))
    .filter(r => r.p)
    .sort((a, b) => b.won - a.won || b.played - a.played)

  if (!rows.length) {
    view.body.append(el('p', { class: 'muted center' }, 'Ancora nessuna partita registrata. Gioca per vedere le statistiche!'))
    return view
  }

  const table = el('div', { class: 'stats-table' })
  table.append(el('div', { class: 'stats-head' }, [
    el('span', {}, 'Giocatore'), el('span', {}, 'Giocate'), el('span', {}, 'Vinte'), el('span', {}, '%')
  ]))
  for (const r of rows) {
    const pct = r.played ? Math.round((r.won / r.played) * 100) : 0
    table.append(el('div', { class: 'stats-row' }, [
      el('span', { class: 'stats-player' }, [avatar(r.p, 26), el('span', {}, r.p.name)]),
      el('span', {}, String(r.played)),
      el('span', {}, String(r.won)),
      el('span', {}, pct + '%')
    ]))
  }
  view.body.append(table)
  return view
}

// ---------- helpers ----------
function section(title, children = []) {
  return el('section', { class: 'card-section' }, [el('h2', { class: 'section-title' }, title), ...children])
}

function stepper(label, getVal, setVal, min, max) {
  const val = el('span', { class: 'stepper-val' }, String(getVal()))
  const node = el('div', { class: 'row space-between stepper' }, [
    el('span', {}, label),
    el('div', { class: 'stepper-ctrl' }, [
      el('button', { class: 'round-btn', onclick: () => { const v = Math.max(min, getVal() - 1); setVal(v); val.textContent = v } }, '−'),
      val,
      el('button', { class: 'round-btn', onclick: () => { const v = Math.min(max, getVal() + 1); setVal(v); val.textContent = v } }, '+')
    ])
  ])
  return { node, refresh: () => { val.textContent = String(getVal()) } }
}
