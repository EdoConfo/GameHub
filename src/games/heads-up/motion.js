// Tilt handling for the "phone on forehead" game.
//
// The phone is held in landscape, vertical, screen facing the other players.
// We DON'T use Euler angles (beta/gamma): held vertical they sit near ±90°
// and hit gimbal lock, so gamma jitters and fires randomly.
//
// Instead we read gravity along the screen-normal axis (device Z) from
// `devicemotion` -> accelerationIncludingGravity.z:
//   screen vertical (facing forward)  -> z ≈ 0      (neutral)
//   screen tilted to face the FLOOR   -> |z| grows toward 1g in one sign
//   screen tilted to face the CEILING -> grows in the other sign
// This is monotonic and independent of landscape-left vs landscape-right,
// so there's no gimbal lock. The `invert` flag flips the sign mapping for
// devices/orientations that report the opposite sign.
//
// iOS 13+ requires an explicit permission request from a user gesture.
// Tap fallbacks in screens.js keep the game playable without any sensor.

const TRIGGER = 5.2   // m/s^2 of gravity on Z to fire (~32° tilt)
const RESET = 3.0     // must fall back under this before firing again

export function motionSupported() {
  return typeof window !== 'undefined' &&
    ('DeviceMotionEvent' in window || 'ondevicemotion' in window)
}

export function needsPermission() {
  return (
    typeof DeviceMotionEvent !== 'undefined' &&
    typeof DeviceMotionEvent.requestPermission === 'function'
  )
}

// Call from a user gesture. Resolves true if granted or not required.
export async function ensurePermission() {
  if (!motionSupported()) return false
  const reqs = []
  if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
    reqs.push(DeviceMotionEvent.requestPermission())
  }
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    reqs.push(DeviceOrientationEvent.requestPermission())
  }
  if (!reqs.length) return true
  try {
    const results = await Promise.all(reqs)
    return results.every(r => r === 'granted')
  } catch {
    return false
  }
}

// Create a tilt watcher. onAction gets 'correct' | 'pass'.
export function createTilt({ onAction, invert = false }) {
  let armed = true
  let active = false
  let gotReading = false

  function handle(e) {
    const g = e.accelerationIncludingGravity
    if (!g || g.z == null) return
    gotReading = true
    const z = g.z

    if (armed) {
      if (z > TRIGGER) fire(invert ? 'pass' : 'correct')
      else if (z < -TRIGGER) fire(invert ? 'correct' : 'pass')
    } else if (Math.abs(z) < RESET) {
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
      armed = true
      window.addEventListener('devicemotion', handle, true)
    },
    stop() {
      active = false
      window.removeEventListener('devicemotion', handle, true)
    },
    recalibrate() { armed = true },
    hasReading() { return gotReading }
  }
}
