import { el, screen, button, shuffle, icon } from '../../shared/ui.js'
import { renderPackManager } from '../../shared/packManagerScreen.js'
import { createArcWheel } from '../../shared/arcWheel.js'
import { ensurePermission, motionSupported } from './motion.js'

// Build the word list from the chosen pack (single words). Falls back to
// all enabled words if the pack is gone.
function buildWords(store, packId) {
  const pack = store.getPack(packId)
  const words = pack ? pack.items : store.enabledItems()
  return shuffle(words.slice())
}

// ---------- HOME (mirrored arc menu on the right) ----------
export function renderHome(api) {
  const { ctx } = api
  const wrap = el('div', { class: 'hub game-home' })

  wrap.append(el('div', { class: 'hub-header' }, [
    el('button', { class: 'icon-btn', 'aria-label': 'Indietro', onclick: () => ctx.router.go('/') }, icon('back')),
    el('span', { class: 'wordmark game-home-title' }, 'HEADS UP')
  ]))

  const host = el('div', { class: 'arc-host' })
  wrap.append(host)
  wrap.append(el('div', { class: 'hub-hint' }, 'scorri per scegliere · tocca per aprire'))

  const entries = [
    { title: 'Gioca', sub: 'Nuova partita', phase: 'setup' },
    { title: 'Parole', sub: 'Categorie', phase: 'packs' },
    { title: 'Come si gioca', sub: 'Regole', phase: 'rules' }
  ]
  createArcWheel(host, { side: 'right', items: entries, onActivate: i => api.goPhase(entries[i].phase) })
  return wrap
}

// ---------- RULES ----------
export function renderRules(api) {
  const view = screen({ title: 'Come si gioca', onBack: () => api.goPhase('home') })
  const rule = (t, d) => el('div', { class: 'rule' }, [el('div', { class: 'rule-title' }, t), el('div', { class: 'rule-desc muted' }, d)])
  view.body.append(section('In breve', [
    rule('Telefono in fronte', 'Un giocatore tiene il telefono sulla fronte, schermo verso gli altri.'),
    rule('Gli altri danno indizi', 'Descrivono la parola senza dirla, finché non la indovini.'),
    rule('Inclina', 'Giù = indovinata, su = passo. In alternativa tocca lo schermo (destra = giusto, sinistra = passo).')
  ]))
  view.body.append(section('Obiettivo', [
    rule('Più parole possibili', 'Indovinane il più possibile prima che scada il tempo.')
  ]))
  return view
}

// ---------- PACKS (manage words for this game) ----------
export function renderPacks(api) {
  return renderPackManager(api.packs, {
    title: 'Parole',
    help: 'Parole e nomi da indovinare. Attiva le categorie da giocare; puoi aggiungerne di tue.',
    onBack: () => api.goPhase('home')
  })
}

// ---------- SETUP ----------
export function renderSetup(api) {
  const { ctx, state } = api
  const view = screen({ title: 'Heads Up', onBack: () => api.goPhase('home') })
  const packs = api.packs.enabledPacks()

  // Keep the selection valid against the currently enabled packs.
  if (!packs.some(p => p.id === state.packId)) state.packId = packs[0]?.id || null

  // Pack picker
  const sec1 = section('Categoria')
  const chips = el('div', { class: 'chip-list' })
  function refreshPacks() {
    chips.replaceChildren()
    if (!packs.length) {
      chips.append(el('p', { class: 'muted' }, 'Nessuna categoria attiva. Aggiungine o attivane una in “Gestisci parole”.'))
    }
    for (const p of packs) {
      chips.append(el('button', {
        class: 'chip selectable' + (state.packId === p.id ? ' on' : ''),
        onclick: () => { state.packId = p.id; refreshPacks() }
      }, `${p.name} (${p.items.length})`))
    }
  }
  refreshPacks()
  sec1.append(chips)
  sec1.append(el('button', { class: 'link-btn', onclick: () => api.goPhase('packs') }, 'Gestisci parole'))

  // Duration
  const sec2 = section('Durata')
  const durRow = el('div', { class: 'chip-list' })
  function refreshDur() {
    durRow.replaceChildren()
    for (const d of api.DURATIONS) {
      durRow.append(el('button', {
        class: 'chip selectable' + (state.duration === d ? ' on' : ''),
        onclick: () => { state.duration = d; refreshDur() }
      }, `${d}s`))
    }
  }
  refreshDur()
  sec2.append(durRow)

  // Controls
  const sec3 = section('Comandi')
  sec3.append(el('p', { class: 'muted' },
    motionSupported()
      ? 'Inclina il telefono in giù = giusto, in su = passo. In alternativa tocca lo schermo: destra = giusto, sinistra = passo.'
      : 'Sensore non disponibile: tocca lo schermo — destra = giusto, sinistra = passo.'))
  sec3.append(el('label', { class: 'row space-between' }, [
    el('span', {}, 'Inverti inclinazione'),
    el('input', { type: 'checkbox', checked: state.invert, onchange: e => { state.invert = e.target.checked } })
  ]))

  const startBtn = button('Continua', {
    variant: 'primary', full: true,
    disabled: !state.packId,
    onClick: () => { if (state.packId) api.goPhase('ready') }
  })

  view.body.append(sec1, sec2, sec3, startBtn)
  return view
}

// ---------- READY ----------
export function renderReady(api) {
  const { ctx, state } = api
  const view = screen({ title: 'Pronti?', onBack: () => api.goPhase('setup') })

  view.body.append(el('div', { class: 'ready-block' }, [
    el('div', { class: 'ready-emoji' }, '📱'),
    el('ol', { class: 'ready-steps' }, [
      el('li', {}, 'Gira il telefono in orizzontale.'),
      el('li', {}, 'Tienilo sulla fronte, schermo verso gli altri.'),
      el('li', {}, 'Gli altri ti danno indizi. Indovina la parola!'),
      el('li', {}, 'Giù = giusto · Su = passo (oppure tocca destra/sinistra).')
    ])
  ]))

  const startBtn = button('Avvia', {
    variant: 'primary', full: true, onClick: async () => {
      // Permission must be requested from this user gesture (iOS).
      state.motionGranted = await ensurePermission()
      state.words = buildWords(api.packs, state.packId)
      state.index = 0
      state.score = 0
      state.results = []
      api.goPhase('countdown')
    }
  })
  view.body.append(startBtn)
  return view
}

// ---------- COUNTDOWN ----------
export function renderCountdown(api) {
  const { state, runtime } = api
  const wrap = el('div', { class: 'fullscreen center-col' })
  const num = el('div', { class: 'countdown-num' }, '3')
  wrap.append(num)

  let n = 3
  runtime.countdown = setInterval(() => {
    n--
    if (n > 0) num.textContent = String(n)
    else if (n === 0) num.textContent = 'Via!'
    else {
      clearInterval(runtime.countdown)
      runtime.countdown = null
      api.goPhase('play')
    }
  }, 800)

  return wrap
}

// ---------- PLAY ----------
export function renderPlay(api) {
  const { state, runtime } = api

  const wrap = el('div', { class: 'fullscreen play-area' })
  const timerBar = el('div', { class: 'timer-bar' })
  const timerFill = el('div', { class: 'timer-fill' })
  timerBar.append(timerFill)
  const scoreEl = el('div', { class: 'play-score' }, '0')
  const wordEl = el('div', { class: 'play-word' })
  const hint = el('div', { class: 'play-hint' }, '← passo · giusto →')

  wrap.append(
    el('div', { class: 'play-top' }, [timerBar, scoreEl]),
    wordEl,
    hint
  )

  function showWord() {
    if (state.index >= state.words.length) {
      // Ran out: reshuffle and keep going.
      state.words = shuffle(state.words)
      state.index = 0
    }
    wordEl.textContent = state.words[state.index] || '—'
  }

  let locked = false
  function action(kind) {
    if (locked || state.phase !== 'play') return
    locked = true
    const word = state.words[state.index] || ''
    const correct = kind === 'correct'
    state.results.push({ word, correct })
    if (correct) state.score++
    scoreEl.textContent = String(state.score)
    wrap.classList.add(correct ? 'flash-ok' : 'flash-pass')
    setTimeout(() => {
      wrap.classList.remove('flash-ok', 'flash-pass')
      state.index++
      showWord()
      locked = false
    }, 320)
  }

  // Tap fallback: left half = pass, right half = correct. Always available.
  wrap.addEventListener('click', e => {
    const rect = wrap.getBoundingClientRect()
    action((e.clientX - rect.left) > rect.width / 2 ? 'correct' : 'pass')
  })

  // Tilt control (if permission granted / supported).
  if (state.motionGranted) {
    runtime.tilt = api.createTilt({ onAction: action, invert: state.invert })
    runtime.tilt.start()
    runtime.tilt.recalibrate()
    // If no sensor reading arrives, make the tap fallback obvious.
    setTimeout(() => {
      if (state.phase === 'play' && runtime.tilt && !runtime.tilt.hasReading()) {
        hint.textContent = 'Sensore assente — tocca: ← passo · giusto →'
      }
    }, 1800)
  } else {
    hint.textContent = 'Tocca: ← passo · giusto →'
  }

  // Timer.
  state.timeLeft = state.duration
  timerFill.style.width = '100%'
  runtime.timer = setInterval(() => {
    state.timeLeft--
    const pct = Math.max(0, (state.timeLeft / state.duration) * 100)
    timerFill.style.width = pct + '%'
    if (state.timeLeft <= 0) {
      api.stopRuntime()
      api.goPhase('results')
    }
  }, 1000)

  showWord()
  return wrap
}

// ---------- RESULTS ----------
export function renderResults(api) {
  const { ctx, state } = api
  const view = screen({ title: 'Risultato', onBack: () => ctx.router.go('/') })

  const correct = state.results.filter(r => r.correct)
  const passed = state.results.filter(r => !r.correct)

  view.body.append(el('div', { class: 'result-hero' }, [
    el('h2', { class: 'result-headline' }, `${correct.length} indovinate`),
    el('p', { class: 'muted center' }, `${passed.length} passate · ${state.duration}s`)
  ]))

  if (correct.length) {
    view.body.append(section('Indovinate ✅', [wordChips(correct, 'ok')]))
  }
  if (passed.length) {
    view.body.append(section('Passate ⏭️', [wordChips(passed, 'pass')]))
  }
  if (!state.results.length) {
    view.body.append(el('p', { class: 'muted center' }, 'Nessuna parola giocata.'))
  }

  view.body.append(el('div', { class: 'row stack' }, [
    button('Rigioca', { variant: 'primary', full: true, onClick: () => api.goPhase('ready') }),
    button('Cambia categoria', { variant: 'secondary', full: true, onClick: () => api.goPhase('setup') }),
    button('Torna alla home', { variant: 'ghost', full: true, onClick: () => ctx.router.go('/') })
  ]))
  return view
}

// ---------- helpers ----------
function section(title, children = []) {
  return el('section', { class: 'card-section' }, [el('h2', { class: 'section-title' }, title), ...children])
}

function wordChips(list, kind) {
  const box = el('div', { class: 'chip-list' })
  for (const r of list) box.append(el('span', { class: 'chip result-chip ' + kind }, r.word))
  return box
}
