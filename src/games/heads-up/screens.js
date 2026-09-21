// The two screens a turn is actually played on. Everything else — teams, the
// category, whose turn, the standings — lives at the table (match.js).
//
// These two take the whole screen on purpose: the phone is on somebody's
// forehead, and the table behind it is nobody's business for the next minute.
import { el, shuffle } from '../../shared/ui.js'
import { t } from '../../shared/i18n.js'

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
    else if (n === 0) num.textContent = t('hu.countdown.go')
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
  const team = state.teams[state.turn % state.teams.length]

  const wrap = el('div', { class: 'fullscreen play-area' })
  const timerBar = el('div', { class: 'timer-bar' })
  const timerFill = el('div', { class: 'timer-fill' })
  timerBar.append(timerFill)
  const scoreEl = el('div', { class: 'play-score' }, '0')
  const wordEl = el('div', { class: 'play-word' })
  const hint = el('div', { class: 'play-hint' }, t('hu.play.hint'))

  wrap.append(
    el('div', { class: 'play-top' }, [timerBar, scoreEl]),
    el('div', { class: 'play-team team-' + team.i }, team.name),
    wordEl,
    hint
  )

  // The pool is the whole match's, walked straight through, so two teams never
  // get the same word. Only if it runs dry does it shuffle and come round
  // again — better a repeat than an empty screen.
  function showWord() {
    if (state.cursor >= state.words.length) {
      state.words = shuffle(state.words)
      state.cursor = 0
    }
    wordEl.textContent = state.words[state.cursor] || '—'
  }

  let locked = false
  function action(kind) {
    if (locked || state.phase !== 'play') return
    locked = true
    const word = state.words[state.cursor] || ''
    const correct = kind === 'correct'
    state.results.push({ word, correct })
    if (correct) {
      team.score++
      scoreEl.textContent = String(state.results.filter(r => r.correct).length)
    }
    wrap.classList.add(correct ? 'flash-ok' : 'flash-pass')
    setTimeout(() => {
      wrap.classList.remove('flash-ok', 'flash-pass')
      state.cursor++
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
        hint.textContent = t('hu.play.noSensorHint')
      }
    }, 1800)
  } else {
    hint.textContent = t('hu.play.tapHint')
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
      api.goPhase('tally')
    }
  }, 1000)

  showWord()
  return wrap
}
