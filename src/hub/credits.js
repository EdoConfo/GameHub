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

  stage.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip() }
  })

  // ---- il dito ----
  // Un tocco gira la carta, un trascinamento la inclina, e le due cose non
  // devono accavallarsi: senza la soglia qui sotto ogni inclinazione finiva
  // con un giro involontario, perché al rilascio parte comunque un click.
  const SLOP = 10
  let p0 = null, moved = false

  const aim = e => {
    const r = stage.getBoundingClientRect()
    tilt((e.clientX - r.left) / r.width * 2 - 1, (e.clientY - r.top) / r.height * 2 - 1)
  }

  stage.addEventListener('pointerdown', e => {
    if (e.target.closest('a')) return
    p0 = { x: e.clientX, y: e.clientY }
    moved = false
    try { stage.setPointerCapture(e.pointerId) } catch { /* non catturabile */ }
    if (!still && !motionOn) { stage.classList.add('ec-live'); aim(e) }
  })

  stage.addEventListener('pointermove', e => {
    if (p0 && Math.hypot(e.clientX - p0.x, e.clientY - p0.y) > SLOP) moved = true
    if (still || motionOn) return
    // col mouse basta passarci sopra; col dito serve tenerlo premuto
    if (p0 || e.pointerType === 'mouse') { stage.classList.add('ec-live'); aim(e) }
  })

  stage.addEventListener('pointerup', e => {
    const wasTap = p0 && !moved
    p0 = null
    if (!motionOn) { stage.classList.remove('ec-live'); rest() }
    if (wasTap && !e.target.closest('a')) flip()
  })

  stage.addEventListener('pointercancel', () => {
    p0 = null
    if (!motionOn) { stage.classList.remove('ec-live'); rest() }
  })
  stage.addEventListener('pointerleave', () => {
    if (!p0 && !motionOn) { stage.classList.remove('ec-live'); rest() }
  })
  // il giro lo fa già pointerup: un click in più lo annullerebbe
  stage.addEventListener('click', e => { if (!e.target.closest('a')) e.preventDefault() })

  function tilt(nx, ny) {
    nx = clamp(nx, -1, 1); ny = clamp(ny, -1, 1)
    deck.style.setProperty('--ry', `${nx * 14}deg`)
    deck.style.setProperty('--rx', `${-ny * 10}deg`)
    // La banda d'oro attraversa la h quando --glint passa da 60 a 190.
    deck.style.setProperty('--glint', `${120 + nx * 90}`)
  }
  function rest() {
    deck.style.setProperty('--ry', '0deg')
    deck.style.setProperty('--rx', '0deg')
    deck.style.removeProperty('--glint')
  }

  // ---- il telefono ----
  // Il giroscopio ha un bottone suo. Nasconderlo dietro il tocco sulla carta
  // voleva dire far comparire il dialogo di sistema di iOS a chi stava solo
  // girando il biglietto — e su iOS la richiesta vale solo se parte da un
  // gesto, quindi doveva comunque essere un gesto esplicito.
  let motionOn = false
  let zero = null   // come il telefono era tenuto all'accensione: quello è il piano

  function onOrient(e) {
    if (e.beta == null && e.gamma == null) return
    const beta = e.beta || 0, gamma = e.gamma || 0
    if (!zero) zero = { beta, gamma }
    tilt((gamma - zero.gamma) / 26, (beta - zero.beta) / 26)
  }

  function startMotion() {
    motionOn = true
    zero = null
    stage.classList.add('ec-live')
    motionBtn.classList.add('on')
    motionBtn.textContent = t('credits.motionOn')
    addEventListener('deviceorientation', onOrient)
  }
  function stopMotion() {
    motionOn = false
    removeEventListener('deviceorientation', onOrient)
    stage.classList.remove('ec-live')
    motionBtn.classList.remove('on')
    motionBtn.textContent = t('credits.motion')
    rest()
  }

  const motionBtn = el('button', {
    class: 'ec-motion',
    type: 'button',
    onclick: () => {
      if (motionOn) return stopMotion()
      if (!needsPermission) return startMotion()
      // deve restare qui dentro: iOS rifiuta la richiesta fatta fuori da un gesto
      DeviceOrientationEvent.requestPermission()
        .then(r => { if (r === 'granted') startMotion() })
        .catch(() => {})
    }
  }, t('credits.motion'))

  const hasMotion = !still && typeof DeviceOrientationEvent !== 'undefined' &&
    matchMedia('(pointer: coarse)').matches

  const card = modal({
    content: [stage, hint, hasMotion ? motionBtn : null].filter(Boolean),
    actions: [button(t('common.done'), { variant: 'ghost', onClick: () => card.close() })]
  })
  card.overlay.classList.add('credits-card')

  // il sensore non deve restare acceso dietro un pannello chiuso
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
