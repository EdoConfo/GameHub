// Word packs that live in the database instead of in the code.
//
// Downloaded once — the first time the app runs with a network — and kept on
// the phone, so they play offline like everything else. After that the app only
// asks for a number: the pack's revision, which the database raises by itself
// whenever the pack is edited. A different number means the copy on the phone
// is behind, and the hub offers to catch up with the same pill it uses for a
// new version of the app. Catching up is just data: nothing reloads.
//
// A first download is never asked about: an app with no copy at all simply
// fetches it. The question only makes sense once there's something to replace.
import * as storage from './storage.js'
import { rest } from './supabase.js'

const EVERY = 60 * 1000             // while the app is on screen
const PAGE = 1000                   // rows per request; the API caps a response
const sources = []
const watchers = new Set()

const behind = () => sources.some(s => s.behind)
const announce = () => { const v = behind(); for (const fn of watchers) fn(v) }

// Tell me whether any pack is behind the database.
export function onWordsUpdate(fn) {
  watchers.add(fn)
  fn(behind())
  return () => watchers.delete(fn)
}

//   key:   the pack's name in pack_revisions
//   table: where its rows are
//   select: the columns to fetch
//   build: rows -> the pack, in the shape packStore reads
export function remotePack({ key, table, select, build }) {
  const STORE = 'remote:' + key
  const changed = new Set()
  let memo = null

  async function revision() {
    const rows = await rest(`pack_revisions?pack=eq.${encodeURIComponent(key)}&select=revision`)
    return rows && rows[0] ? rows[0].revision : null
  }

  async function download() {
    const all = []
    for (let from = 0; ; from += PAGE) {
      const page = await rest(`${table}?select=${select}&order=id`, { range: [from, from + PAGE - 1] })
      all.push(...page)
      if (page.length < PAGE) return all
    }
  }

  const src = {
    behind: false,

    // What's on the phone, in the shape the store wants. Null until the first
    // download has happened.
    get() {
      const saved = storage.get(STORE, null)
      if (!saved || !saved.pack) return null
      if (!memo || memo.revision !== saved.revision) memo = { revision: saved.revision, pack: saved.pack }
      return memo.pack
    },
    has() { return !!storage.get(STORE, null) },

    // Tell me when the copy on the phone has been replaced.
    onChange(fn) { changed.add(fn); return () => changed.delete(fn) },

    // Is the database ahead of us? Offline, or the database unreachable: say
    // nothing and try again later.
    async check() {
      let live
      try { live = await revision() } catch { return }
      if (live == null) return
      const saved = storage.get(STORE, null)
      if (!saved) { await src.refresh().catch(() => {}); return }
      const was = src.behind
      src.behind = saved.revision !== live
      if (src.behind !== was) announce()
    },

    // Replace the copy on the phone with the database's. The revision is read
    // first: if the pack changes while we download, the number we save is the
    // older one, and the next check simply offers the update again.
    async refresh() {
      const live = await revision()
      const rows = await download()
      storage.set(STORE, { revision: live, pack: build(rows) })
      memo = null
      src.behind = false
      announce()
      for (const fn of changed) fn()
    }
  }
  sources.push(src)
  return src
}

// Catch up every pack that's behind. Resolves when they're all done; a pack
// that fails stays behind, and the pill comes back to say so.
export async function refreshWords() {
  await Promise.all(sources.filter(s => s.behind).map(s => s.refresh().catch(() => {})))
  announce()
}

export function startRemotePacks() {
  const look = () => {
    if (document.visibilityState !== 'visible' || !navigator.onLine) return
    for (const s of sources) s.check()
  }
  setInterval(look, EVERY)
  document.addEventListener('visibilitychange', look)
  window.addEventListener('online', look)
  look()
}
