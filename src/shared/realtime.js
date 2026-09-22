// The room's wire: what one phone says to the others, and nothing else.
//
// Supabase Realtime in BROADCAST mode. A message goes phone → Supabase → the
// other phones and is never written down: no table, no rows, nothing to clean
// up afterwards, and the public key in supabase.js still can't read or change
// a single row of the database. That promise stays exactly as it was.
//
// Broadcast and not the database's own change feed, because a party game is
// judged on how fast it answers: a row that has to be written, replicated and
// read back costs a hundred milliseconds and more, for something nobody will
// ever want to read again.
//
// What this module knows: how to open a named room, send a message into it and
// hear the ones that arrive. Who is playing, whose turn it is and what a vote
// means live one floor up (games/quiplash/game.js).
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase.js'

// The room's name on the wire. Prefixed, because the channel names are shared
// with every other app on the same Supabase project.
const topic = code => `gamehub:quiplash:${String(code).toUpperCase()}`

// Room codes are read out loud across a table and typed on a phone keyboard,
// so the letters that get misheard or mistyped are simply not in the alphabet:
// no O/0, no I/1, no S/5, no B/8, no Z/2.
const ALPHABET = 'ACDEFGHJKLMNPQRTUVWXY34679'
// Four: enough for half a million rooms, short enough to say once and to fit
// in four boxes on a phone. The number lives here because the screen that
// takes the code draws one box per character (guest.js).
export const CODE_LEN = 4
export function newCode(len = CODE_LEN) {
  let out = ''
  const r = new Uint8Array(len)
  crypto.getRandomValues(r)
  for (let i = 0; i < len; i++) out += ALPHABET[r[i] % ALPHABET.length]
  return out
}
export const cleanCode = raw => String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LEN)

// The socket is built the first time a room is opened, never at startup: an
// app that is only ever played by passing one phone around must not open a
// websocket to say so. Loaded the same way, so the download only happens for
// whoever actually plays across phones — and once loaded it is precached with
// the rest of the app, so it works from the second time even offline.
let client = null
async function socket() {
  if (!client) {
    const { RealtimeClient } = await import('@supabase/realtime-js')
    client = new RealtimeClient(`${SUPABASE_URL}/realtime/v1`, {
      params: { apikey: SUPABASE_ANON_KEY },
      // A phone that locks its screen drops the socket; this is how long it
      // takes to notice and come back.
      heartbeatIntervalMs: 15000
    })
  }
  return client
}

// While the app is being developed, two tabs of the same browser can be a room
// of their own: ?loopback in the address and the messages never leave the
// machine. It costs nothing in the built app — the check is a constant there,
// and the branch goes out with the rest of the dead code.
const wantsLoopback = () =>
  import.meta.env.DEV &&
  typeof location !== 'undefined' &&
  new URLSearchParams(location.search).has('loopback')

function loopbackRoom(code, { onMessage, onStatus }) {
  const bus = new BroadcastChannel(topic(code))
  const me = Math.random().toString(36).slice(2)
  bus.onmessage = e => {
    const m = e.data
    if (!m || m.from === me) return // broadcast never comes back to the sender
    onMessage(m.event, m.payload)
  }
  setTimeout(() => onStatus('on'), 0)
  return {
    send(event, payload) { bus.postMessage({ from: me, event, payload }) },
    leave() { bus.close() }
  }
}

// Open the room `code`.
//   onMessage(event, payload)  a message from another phone in it
//   onStatus('wait' | 'on' | 'off')  is this phone actually in the room?
//   -> { send(event, payload), leave() }
//
// Messages sent before the room is open wait in a queue and go as soon as it
// is: the caller never has to know whether the socket has settled.
export function openRoom(code, { onMessage, onStatus = () => {} } = {}) {
  if (wantsLoopback()) return loopbackRoom(code, { onMessage, onStatus })

  let channel = null
  let live = false
  let gone = false
  const queued = []

  const flush = () => {
    if (!live || !channel) return
    while (queued.length) {
      const m = queued.shift()
      channel.send({ type: 'broadcast', event: m.event, payload: m.payload })
    }
  }

  ;(async () => {
    const c = await socket()
    if (gone) return
    channel = c.channel(topic(code), { config: { broadcast: { self: false } } })
    channel.on('broadcast', { event: '*' }, m => onMessage(m.event, m.payload))
    channel.subscribe(status => {
      if (gone) return
      live = status === 'SUBSCRIBED'
      onStatus(live ? 'on' : status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED' ? 'off' : 'wait')
      flush()
    })
  })().catch(() => { if (!gone) onStatus('off') })

  return {
    send(event, payload) {
      if (live && channel) channel.send({ type: 'broadcast', event, payload })
      // Not in yet: it goes when we are. The newest state wins over an older
      // one of the same kind — nobody needs yesterday's snapshot.
      else {
        const at = queued.findIndex(m => m.event === event && event === 'state')
        if (at >= 0) queued[at] = { event, payload }
        else queued.push({ event, payload })
      }
    },
    leave() {
      gone = true
      live = false
      queued.length = 0
      if (channel) { try { channel.unsubscribe() } catch { /* already gone */ } }
      channel = null
    }
  }
}
