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
// Noticing has to happen while the app is open, not the next time it's opened.
// The service worker's own check only runs when a page loads, so every deploy
// also publishes version.json — the build it is — and the app reads it once a
// minute while it's on screen, bypassing every cache. A different build there
// means there's something newer, and the button shows at once; the worker is
// told to go and get it at the same moment, so it's usually ready by the tap.

const EVERY = 60 * 1000            // while the app is on screen
const HERE = typeof __BUILD__ === 'string' ? __BUILD__ : null
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

// Take it, and reload now.
//
// If the new worker is already installed it's asked to step forward, and the
// page reloads the moment it's in charge — reloading before that would only get
// the old page back from the old worker's cache, and would cancel the handover
// on the way. If there's no new worker yet (the check is quicker than the
// download) there is nothing to hand over: the workers are cleared and the page
// comes straight from the network. Either way the tap ends in a reload, and
// promptly — there's no waiting for a signal that isn't coming.
export async function update() {
  waiting = false
  announce()

  let done = false
  const go = () => { if (!done) { done = true; location.reload() } }
  if (!('serviceWorker' in navigator)) { go(); return }
  navigator.serviceWorker.addEventListener('controllerchange', go, { once: true })

  try { if (skip) skip() } catch { /* the browser's own copy is asked next */ }
  let reg = null
  try { reg = await navigator.serviceWorker.getRegistration() } catch { /* nothing registered */ }
  const pending = reg && reg.waiting
  if (!pending) { await escape(); go(); return }

  pending.addEventListener('statechange', () => { if (pending.state === 'activated') go() })
  pending.postMessage({ type: 'SKIP_WAITING' })
  // a handover that never lands is no reason to stay stuck
  setTimeout(async () => { if (!done) { await escape(); go() } }, GIVE_UP)
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

  let registration = null
  skip = registerSW({
    immediate: true,
    onNeedRefresh() { waiting = true; announce() },
    onRegisteredSW(url, r) { registration = r || null }
  })

  // Is the build on the server the one running here? no-store and a throwaway
  // query keep every cache out of it, the browser's and the CDN's alike.
  async function look() {
    if (!HERE || document.visibilityState !== 'visible' || !navigator.onLine) return
    let live = null
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' })
      if (res.ok) live = (await res.json()).build
    } catch { return }
    if (!live || live === HERE || waiting) return
    waiting = true
    announce()
    if (registration) registration.update().catch(() => {})   // start fetching it now
  }

  setInterval(look, EVERY)
  document.addEventListener('visibilitychange', look)
  window.addEventListener('online', look)
  look()
}
