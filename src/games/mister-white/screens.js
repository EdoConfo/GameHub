import { el, screen, button, modal, toast, clear } from '../../shared/ui.js'
import { renderPackManager } from '../../shared/packManagerScreen.js'
import {
  ROLE, roleLabel, suggestCounts, validateSetup,
  buildRound, checkWinner, guessMatches
} from './engine.js'

// ---------- SETUP ----------
export function renderSetup(api) {
  const { ctx, state } = api
  const view = screen({ title: 'Mister White', onBack: () => ctx.router.go('/') })

  // --- Players ---
  const sec1 = section('Chi gioca?')
  const chips = el('div', { class: 'chip-list' })
  const selected = new Set(state.selectedPlayers)

  function refreshChips() {
    clear(chips)
    const roster = ctx.players.all()
    if (!roster.length) {
      chips.append(el('p', { class: 'muted' }, 'Aggiungi i giocatori qui sotto.'))
    }
    for (const name of roster) {
      const on = selected.has(name)
      chips.append(el('button', {
        class: 'chip selectable' + (on ? ' on' : ''),
        onclick: () => {
          if (on) selected.delete(name); else selected.add(name)
          state.selectedPlayers = [...selected]
          refreshChips(); refreshValidity()
        }
      }, name))
    }
  }

  const nameInput = el('input', { class: 'text-input', type: 'text', placeholder: 'Nuovo giocatore…', maxlength: '24' })
  function addPlayer() {
    const v = nameInput.value.trim()
    if (!v) return
    ctx.players.add(v)
    selected.add(v)
    state.selectedPlayers = [...selected]
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
    const names = [...selected]
    const pairs = api.packs.enabledItems()
    if (!pairs.length) return
    const pair = pairs[Math.floor(Math.random() * pairs.length)]
    state.round = buildRound(names, pair, { ...state.counts })
    state.dealIndex = 0
    state.revealed = false
    state.winner = null
    state.mrWhiteGuess = null
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

// ---------- RESULTS ----------
export function renderResults(api) {
  const { ctx, state } = api
  const view = screen({ title: 'Risultato', onBack: () => ctx.router.go('/') })
  const players = state.round.players

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
        const names = state.round.players.map(p => p.name)
        const pairs = api.packs.enabledItems()
        const pair = pairs[Math.floor(Math.random() * pairs.length)]
        state.round = buildRound(names, pair, { ...state.counts })
        state.dealIndex = 0; state.revealed = false
        state.winner = null; state.mrWhiteGuess = null
        api.goPhase('deal')
      }
    }),
    button('Torna alla home', { variant: 'ghost', full: true, onClick: () => ctx.router.go('/') })
  ]))
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
