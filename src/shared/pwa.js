// Whether the app is running as an installed app, and how to become one.
//
// The question "is it installed?" can't actually be answered: the browser only
// tells you how THIS window was opened. Add it to the Home screen and then open
// the same address in Safari, and that tab will say it isn't installed — because
// as far as it's concerned, it isn't. There's no way round that on iOS, so the
// wording never claims more than it knows.
//
// What drives the button is a capability, not a platform: if the browser fires
// `beforeinstallprompt` it can install, and the tap opens the real system
// dialog. Only when it can't do we need to know which phone we're on, and only
// to write the right steps. The day Safari learns to install, this starts
// working there with nothing changed.

let deferred = null                 // the install event, kept for when it's asked for
const watchers = new Set()
const notify = () => { for (const fn of watchers) fn() }

const display = typeof matchMedia === 'function' ? matchMedia('(display-mode: standalone)') : null

// Opened from the Home screen / as an app window. navigator.standalone is the
// old Safari spelling and is still the only one that answers on older iOS.
export function isInstalled() {
  return !!(display && display.matches) || navigator.standalone === true
}

export const canInstall = () => !!deferred

// Which set of steps to show when the browser won't do it for us. Reached only
// after the capability check has already failed, so this is about wording, not
// about deciding. Desktop is not one case: Chrome and Edge put an icon in the
// address bar, Safari hides it in Share as "Add to Dock", and Firefox simply
// can't install a web app at all — telling someone on Firefox to look for a
// button that isn't there is worse than telling them there isn't one.
export function howTo() {
  const ua = navigator.userAgent || ''
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  if (ios) return 'ios'
  if (/Android/.test(ua)) return 'android'
  if (/Firefox\//.test(ua)) return 'none'
  if (/Safari\//.test(ua) && !/Chrome|Chromium|Edg\//.test(ua)) return 'macos'
  return 'desktop'
}

// Ask the browser to install. Returns true if the person went through with it.
// The event is single-use: spent or dismissed, it's gone until the browser
// decides to offer it again.
export async function install() {
  if (!deferred) return false
  const e = deferred
  deferred = null
  notify()
  try {
    e.prompt()
    const { outcome } = await e.userChoice
    return outcome === 'accepted'
  } catch { return false }
}

// Tell me when any of this changes, so the button can say something else.
export function onChange(fn) {
  watchers.add(fn)
  return () => watchers.delete(fn)
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault()            // we'll ask at our own moment, from Impostazioni
    deferred = e
    notify()
  })
  window.addEventListener('appinstalled', () => { deferred = null; notify() })
  if (display) {
    const onDisplay = () => notify()
    if (display.addEventListener) display.addEventListener('change', onDisplay)
    else if (display.addListener) display.addListener(onDisplay)
  }
}
