// "There's a new version" — and a way to take it, at a moment that isn't the
// middle of a round.
//
// Left alone, a service worker hands the page the files it already has and
// fetches the new ones in the background: you play the whole evening on
// yesterday's build and get today's the next time you open the app. Reloading by
// itself would fix that and break something worse — a reload during a match
// throws away the roles that were dealt. So the new version waits, and the app
// offers it where losing nothing is guaranteed.
//
// The browser only looks for a new worker when a page loads. An app left open on
// a table never asks, so we ask for it: when it comes back to the foreground,
// and on a slow timer while it stays there. It's a conditional request for one
// small file — cheap enough to do often, rare enough not to matter.

const EVERY = 30 * 60 * 1000       // while the app stays open
const GIVE_UP = 8000                // how long a handover may take on a tired phone
let waiting = null                  // the update, ready and held back
let skip = null                     // the plugin's own "step forward", from workbox-window
const watchers = new Set()

const announce = () => { for (const fn of watchers) fn(!!waiting) }

// Tell me when an update is ready (or has just been taken).
export function onUpdate(fn) {
  watchers.add(fn)
  fn(!!waiting)
  return () => watchers.delete(fn)
}

export const isReady = () => !!waiting

// Take it: ask the waiting worker to step forward, and reload once it has.
//
// Two things went wrong here before, and both are about not trusting a single
// source. The worker that triggered the notice is known to workbox-window, which
// is what raised it; asking only our own copy of the registration meant that,
// on a phone where that copy said nobody was waiting, the tap fell into a plain
// reload — the old worker answered it from its cache, the same page came back,
// and so did the notice. Worse, that shortcut skipped the way out below
// entirely. So now every source is asked, and there is no shortcut: once the
// notice has been shown, a tap always runs the whole path, deadline included.
//
// Nothing reloads while a handover may still be in flight: the navigation would
// cancel it, and a reload before the new worker is in charge only brings the
// old page back. The signals that it is in charge are the controller changing
// and the waiting worker reaching 'activated' — either can be missed, so both
// are watched and the first one wins.
export async function update() {
  waiting = false
  announce()

  let done = false
  const go = () => { if (!done) { done = true; location.reload() } }
  navigator.serviceWorker.addEventListener('controllerchange', go, { once: true })

  // workbox-window's idea of the waiting worker, then the browser's own
  try { if (skip) skip() } catch { /* the next one may still work */ }
  let reg = null
  try { reg = await navigator.serviceWorker.getRegistration() } catch { /* offline, or no worker */ }
  const pending = reg && reg.waiting
  if (pending) {
    pending.addEventListener('statechange', () => { if (pending.state === 'activated') go() })
    pending.postMessage({ type: 'SKIP_WAITING' })
  }

  setTimeout(async () => {
    if (done) return
    let still = null
    try { still = (await navigator.serviceWorker.getRegistration())?.waiting } catch { /* see below */ }
    if (!still && reg && reg.active && navigator.serviceWorker.controller === reg.active) { go(); return }
    await escape()                        // nobody handed over: take the workers out of the way
    go()
  }, GIVE_UP)
}

// The way out of a worker that won't hand over.
//
// It happens, and when it does the app is properly trapped: the old worker keeps
// answering every reload out of its own cache, so the page can never become the
// one that would fix it. No amount of tapping, closing or reopening gets past
// that — the only cures were deleting the app or clearing the site's data, and
// neither is something to ask of someone on a Friday night.
//
// So the last resort is to remove the worker entirely. The next load has nobody
// to intercept it, comes from the network, and registers a fresh one. A moment
// without the offline cache is a small price for not being stuck forever.
async function escape() {
  try {
    const all = await navigator.serviceWorker.getRegistrations()
    await Promise.all(all.map(r => r.unregister()))
    if (window.caches) {
      const names = await caches.keys()
      await Promise.all(names.map(n => caches.delete(n)))
    }
  } catch { /* nothing left to try; the reload happens anyway */ }
}

export async function startUpdates() {
  if (!('serviceWorker' in navigator)) return
  let registerSW
  try {
    // Provided by vite-plugin-pwa. In a dev server without the pwa dev option
    // it simply isn't there, and there is nothing to update anyway.
    ;({ registerSW } = await import('virtual:pwa-register'))
  } catch { return }

  skip = registerSW({
    immediate: true,
    onNeedRefresh() { waiting = true; announce() },
    onRegisteredSW(url, registration) {
      if (!registration) return
      const look = () => { if (navigator.onLine) registration.update().catch(() => {}) }
      setInterval(look, EVERY)
      // coming back to the app is the likeliest moment for it to have aged
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') look()
      })
    }
  })
}
