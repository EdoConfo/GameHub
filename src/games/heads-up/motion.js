// Device-orientation handling for the "phone on forehead" tilt game.
// Phone is held in landscape against the forehead, screen facing the others.
// Tilt the top of the phone toward the floor to mark CORRECT, toward the
// ceiling to PASS (or the reverse, via the invert flag).
//
// iOS 13+ requires an explicit permission request from a user gesture.
// If motion is unavailable or denied, screens.js provides tap fallbacks,
// so the game is always playable.

const TRIGGER = 45   // degrees from neutral to fire an action
const RESET = 20     // must return within this of neutral before firing again

export function motionSupported() {
  return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window
}

export function needsPermission() {
  return (
    motionSupported() &&
    typeof DeviceOrientationEvent.requestPermission === 'function'
  )
}

// Call from a user gesture (e.g. a button tap). Resolves to true if granted
// or not required, false if denied.
export async function ensurePermission() {
  if (!motionSupported()) return false
  if (!needsPermission()) return true
  try {
    const res = await DeviceOrientationEvent.requestPermission()
    return res === 'granted'
  } catch {
    return false
  }
}

// Create a tilt watcher. onAction gets 'correct' | 'pass'.
// invert swaps which direction means correct.
export function createTilt({ onAction, invert = false }) {
  let neutral = null
  let armed = true
  let active = false
  let gotReading = false

  function handle(e) {
    // gamma is the left-right axis; in landscape it tracks the forehead tilt.
    // Fall back to beta if gamma is null on some devices.
    const raw = e.gamma != null ? e.gamma : e.beta
    if (raw == null) return
    gotReading = true
    if (neutral == null) neutral = raw
    const delta = raw - neutral

    if (armed) {
      if (delta > TRIGGER) fire(invert ? 'pass' : 'correct')
      else if (delta < -TRIGGER) fire(invert ? 'correct' : 'pass')
    } else if (Math.abs(delta) < RESET) {
      armed = true
    }
  }

  function fire(action) {
    armed = false
    if (navigator.vibrate) navigator.vibrate(40)
    onAction(action)
  }

  return {
    start() {
      if (active) return
      active = true
      neutral = null
      armed = true
      window.addEventListener('deviceorientation', handle, true)
    },
    stop() {
      active = false
      window.removeEventListener('deviceorientation', handle, true)
    },
    // Re-read neutral (e.g. after the countdown, when the phone is in position).
    recalibrate() { neutral = null },
    hasReading() { return gotReading }
  }
}
