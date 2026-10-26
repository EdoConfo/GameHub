// Chi ha fatto l'app: un biglietto da visita, non una schermata di testo.
//
// Il fronte porta solo il marchio; il retro il nome vero, con in oro le
// lettere da cui "echo" viene — E(doardo) CO(nforti) — e i due link che qui
// hanno senso. Si gira toccandolo e si inclina seguendo il dito.
//
// Il giroscopio è un extra, mai il modo principale di muoverla: da iOS 13
// serve DeviceOrientationEvent.requestPermission(), chiamata dentro il
// gestore di un tocco e solo in HTTPS. Se partisse da sola, a chi apre i
// crediti arriverebbe in faccia un dialogo di sistema che non ha chiesto —
// e su iPhone, senza permesso, la carta resterebbe ferma. Quindi il dito
// funziona sempre e il telefono si aggiunge se glielo chiedi.
import { el, button, modal } from '../shared/ui.js'
import { t } from '../shared/i18n.js'
import { markSvg } from '../shared/mark.js'

const REPO = 'https://github.com/EdoConfo/GameHub'
const AUTHOR = 'https://github.com/EdoConfo'

// Su iOS il permesso esiste come funzione; altrove l'evento arriva e basta.
const needsPermission = typeof DeviceOrientationEvent !== 'undefined' &&
  typeof DeviceOrientationEvent.requestPermission === 'function'

export function openCredits() {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches

  const deck = el('div', { class: 'ec-deck' }, [
    el('div', { class: 'ec-face ec-front', html: markSvg('credits-front') }),
    el('div', { class: 'ec-face ec-back' }, [
      el('p', { class: 'ec-name', html: t('credits.nameHtml') }),
      el('div', { class: 'ec-rule' }),
      el('div', { class: 'ec-links' }, [
        linkRow(t('credits.source'), 'github.com/EdoConfo/GameHub', REPO),
        linkRow(t('credits.author'), 'github.com/EdoConfo', AUTHOR)
      ])
    ])
  ])

  const stage = el('div', {
    class: 'ec-stage',
    role: 'button',
    tabindex: '0',
    'aria-label': t('credits.flip')
  }, [deck])

  const hint = el('p', { class: 'ec-hint' }, t(still ? 'credits.hintStill' : 'credits.hint'))

  let flipped = false
  function flip() {
    flipped = !flipped
    deck.style.setProperty('--flip', flipped ? '180deg' : '0deg')
  }

  // Un link sul retro deve restare toccabile: non gira la carta.
  stage.addEventListener('click', e => {
    if (e.target.closest('a')) return
    askMotionOnce()
    flip()
  })
  stage.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip() }
  })

  // ---- il dito ----
  if (!still) {
    let dragging = false
    const aim = (e, inside) => {
      const r = stage.getBoundingClientRect()
      const px = (e.clientX - r.left) / r.width
      const py = (e.clientY - r.top) / r.height
      tilt((px - .5) * 2, (py - .5) * 2, inside)
    }
    stage.addEventListener('pointerdown', e => {
      dragging = true
      stage.setPointerCapture?.(e.pointerId)
      stage.classList.add('ec-live')
      aim(e, true)
    })
    stage.addEventListener('pointermove', e => {
      if (dragging || e.pointerType === 'mouse') { stage.classList.add('ec-live'); aim(e, true) }
    })
    const release = () => { dragging = false; stage.classList.remove('ec-live'); rest() }
    stage.addEventListener('pointerup', release)
    stage.addEventListener('pointercancel', release)
    stage.addEventListener('pointerleave', () => { if (!dragging) release() })
  }

  function tilt(nx, ny, live) {
    deck.style.setProperty('--ry', `${nx * 14}deg`)
    deck.style.setProperty('--rx', `${-ny * 10}deg`)
    // La banda d'oro attraversa la h quando --glint passa da 60 a 190.
    if (live) deck.style.setProperty('--glint', `${120 + nx * 90}`)
  }
  function rest() {
    deck.style.setProperty('--ry', '0deg')
    deck.style.setProperty('--rx', '0deg')
    deck.style.removeProperty('--glint')
  }

  // ---- il telefono ----
  let motionOn = false
  function onOrient(e) {
    if (e.gamma == null && e.beta == null) return
    // gamma: inclinazione sinistra/destra. beta: avanti/indietro, da cui si
    // toglie l'angolo a cui un telefono viene tenuto davvero (circa 40°).
    const nx = clamp((e.gamma || 0) / 32, -1, 1)
    const ny = clamp(((e.beta || 0) - 40) / 32, -1, 1)
    tilt(nx, ny, true)
  }
  function startMotion() {
    if (motionOn) return
    motionOn = true
    stage.classList.add('ec-live')
    addEventListener('deviceorientation', onOrient)
  }
  // Deve restare dentro il gestore del tocco: iOS rifiuta la richiesta
  // fatta fuori da un gesto dell'utente.
  function askMotionOnce() {
    if (still || motionOn) return
    if (!needsPermission) { startMotion(); return }
    DeviceOrientationEvent.requestPermission()
      .then(r => { if (r === 'granted') startMotion() })
      .catch(() => {})
  }

  const card = modal({
    content: [stage, hint],
    actions: [button(t('common.done'), { variant: 'ghost', onClick: () => card.close() })]
  })
  card.overlay.classList.add('credits-card')

  const close = card.close
  card.close = () => { removeEventListener('deviceorientation', onOrient); close() }
  card.overlay.addEventListener('click', e => {
    if (e.target === card.overlay) removeEventListener('deviceorientation', onOrient)
  })
  return card
}

function linkRow(label, value, href) {
  return el('a', { class: 'ec-link', href, target: '_blank', rel: 'noopener noreferrer' }, [
    el('span', { class: 'ec-link-label' }, label),
    el('span', { class: 'ec-link-value' }, value)
  ])
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v }
