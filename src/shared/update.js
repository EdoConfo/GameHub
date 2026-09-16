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
let waiting = null                  // the update, ready and held back
let apply = null                    // takes it, and reloads
const watchers = new Set()

const announce = () => { for (const fn of watchers) fn(!!waiting) }

// Tell me when an update is ready (or has just been taken).
export function onUpdate(fn) {
  watchers.add(fn)
  fn(!!waiting)
  return () => watchers.delete(fn)
}

export const isReady = () => !!waiting

// Take it. The page reloads, so nothing after this runs.
export function update() {
  if (!waiting || !apply) return
  waiting = false
  apply(true)
}

export async function startUpdates() {
  if (!('serviceWorker' in navigator)) return
  let registerSW
  try {
    // Provided by vite-plugin-pwa. In a dev server without the pwa dev option
    // it simply isn't there, and there is nothing to update anyway.
    ;({ registerSW } = await import('virtual:pwa-register'))
  } catch { return }

  apply = registerSW({
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
