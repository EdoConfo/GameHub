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
const GIVE_UP = 2500                // how long we wait for the worker to hand over
let waiting = null                  // the update, ready and held back
let reg = null                      // the registration, to talk to the worker waiting in it
const watchers = new Set()

const announce = () => { for (const fn of watchers) fn(!!waiting) }

// Tell me when an update is ready (or has just been taken).
export function onUpdate(fn) {
  watchers.add(fn)
  fn(!!waiting)
  return () => watchers.delete(fn)
}

export const isReady = () => !!waiting

// Take it. Either way this ends in a reload — that is the whole promise of the
// button, and a button that sometimes does nothing is worse than no button.
//
// The worker waiting in the registration is asked to step forward, and the page
// reloads when it takes over. It may not: if it had already been activated by
// the time you tapped (the old build did that on its own), nothing hands over
// and no event ever comes. So there's a deadline, and past it we reload anyway —
// by then the new files are the ones being served regardless.
export function update() {
  waiting = false
  announce()
  const pending = reg && reg.waiting
  if (!pending) { location.reload(); return }
  navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true })
  pending.postMessage({ type: 'SKIP_WAITING' })
  setTimeout(() => location.reload(), GIVE_UP)
}

export async function startUpdates() {
  if (!('serviceWorker' in navigator)) return
  let registerSW
  try {
    // Provided by vite-plugin-pwa. In a dev server without the pwa dev option
    // it simply isn't there, and there is nothing to update anyway.
    ;({ registerSW } = await import('virtual:pwa-register'))
  } catch { return }

  registerSW({
    immediate: true,
    onNeedRefresh() { waiting = true; announce() },
    onRegisteredSW(url, registration) {
      if (!registration) return
      reg = registration
      const look = () => { if (navigator.onLine) registration.update().catch(() => {}) }
      setInterval(look, EVERY)
      // coming back to the app is the likeliest moment for it to have aged
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') look()
      })
    }
  })
}
