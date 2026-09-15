// Appearance. Three choices, in the order the Tema bead cycles them:
//
//   system  follow the phone (or the desktop) — the default
//   light   always light
//   dark    always dark
//
// What's stored is the CHOICE, not the colour it resolves to: with 'system'
// the app has to be free to change its mind when the phone does, which it
// couldn't if we'd written down 'dark'. The resolved colour is stamped on
// <html data-theme>, which is what the stylesheet reads, so nothing else in
// the app needs to know any of this.
import * as storage from './storage.js'

// A new key on purpose: the old one held a resolved colour ('light'/'dark')
// written by the app itself, indistinguishable from a deliberate choice. Left
// behind, every phone that ever opened GameHub would stay pinned to the theme
// it happened to have, and would never see the system default.
const KEY = 'themePref'

export const THEMES = ['system', 'light', 'dark']

const media = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(prefers-color-scheme: dark)')
  : null

const BAR = { light: '#eaecf7', dark: '#0a0b16' }

export function getTheme() {
  const value = storage.get(KEY, 'system')
  return THEMES.includes(value) ? value : 'system'
}

// What 'system' means right now.
export function systemTheme() { return media && media.matches ? 'dark' : 'light' }

// The colour actually on screen, once the choice is resolved.
export function activeTheme(pref = getTheme()) {
  return pref === 'system' ? systemTheme() : pref
}

export function applyTheme(pref) {
  const choice = THEMES.includes(pref) ? pref : 'system'
  const active = activeTheme(choice)
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = active
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', BAR[active])
  }
  storage.set(KEY, choice)
  return choice
}

// The Tema bead: one tap moves to the next choice, then wraps.
export function cycleTheme() {
  return applyTheme(THEMES[(THEMES.indexOf(getTheme()) + 1) % THEMES.length])
}

// The phone switching to night mode while the app is open repaints it — but
// only for someone who asked to follow the phone.
export function watchSystem(onChange) {
  if (!media) return () => {}
  const handler = () => {
    if (getTheme() !== 'system') return
    applyTheme('system')
    if (onChange) onChange(activeTheme())
  }
  media.addEventListener('change', handler)
  return () => media.removeEventListener('change', handler)
}
