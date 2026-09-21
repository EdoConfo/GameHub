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
//
// The copy lives in IndexedDB, not localStorage. It used to be localStorage,
// and on a phone whose storage was full the new copy failed to save without a
// word: the pill went away, the count stayed where it was, and reopening the app
// brought the old copy straight back. It's read into memory once at startup
// (hydrateRemotePacks), so everything that asks for it stays synchronous.
import * as storage from './storage.js'
import { idbGet, idbSet } from './idb.js'
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
//   meta:  { table, select } for a second, small table fetched alongside the
//          first — Heads Up keeps its categories in one and their words in the
//          other, and a category is nothing without its name. One counter
//          covers both: renaming a category is a change like any other.
//   build: (rows, metaRows) -> the pack, or a list of them, in the shape
//          packStore reads
export function remotePack({ key, table, select, bustOn = 'id', meta = null, build }) {
  const SHELF = 'remote:' + key         // the IndexedDB key, and the old localStorage one
  // The shape of a saved copy. Copies saved before it existed may hold the
  // wrong pairs under the right revision (the Safari download above), and a
  // matching revision would never be questioned — so they count as no copy, and
  // are fetched again without asking.
  // 3: one row per pair, every language in it (the copies before were built
  // from a table where the languages could drift apart)
  const FORMAT = 3
  const changed = new Set()
  let copy = null                       // { revision, pack }, as it is on the phone
  let hydrated = false

  async function revision() {
    const rows = await rest(`pack_revisions?pack=eq.${encodeURIComponent(key)}&select=revision`)
    return rows && rows[0] ? rows[0].revision : null
  }

  // Every revision gets its own address: the filter id > -revision matches
  // every row (ids start at 1) and only exists to make the URL different, so no
  // cache anywhere can hand back the rows of a revision we're past.
  // The filter that gives every revision its own address. It has to match every
  // row and only exists to make the URL different, so it needs a column of
  // numbers that are never negative: ids (they start at 1) or, where the id is
  // text like hu_packs', whatever the caller names instead.
  const bust = (col, live) => `${col}=gt.-${Number(live) || 0}`

  async function download(live) {
    const all = []
    for (let from = 0; ; from += PAGE) {
      const page = await rest(`${table}?select=${select}&order=id&limit=${PAGE}&offset=${from}&${bust(bustOn, live)}`)
      all.push(...page)
      if (page.length < PAGE) break
    }
    // The meta table is the short one — a handful of categories — so it comes
    // in one request, with the same guard against a stale answer.
    const metaRows = meta
      ? await rest(`${meta.table}?select=${meta.select}&limit=${PAGE}&${bust(meta.bustOn || 'id', live)}`)
      : null
    return { rows: all, meta: metaRows }
  }

  const src = {
    behind: false,

    // What's on the phone, in the shape the store wants. Null until the first
    // download has happened.
    get() { return copy ? copy.pack : null },
    has() { return !!copy },
    revision() { return copy ? copy.revision : null },

    // Read the copy off the phone. A copy still sitting in localStorage from an
    // older version is moved over, and its room given back.
    async hydrate() {
      let saved = null
      try { saved = await idbGet(SHELF) } catch { /* no IndexedDB: fall back below */ }
      if (!saved) {
        const old = storage.get(SHELF, null)
        if (old && old.pack) {
          saved = old
          try { await idbSet(SHELF, old); storage.remove(SHELF) } catch { /* keep it where it is */ }
        }
      }
      if (saved && saved.pack && saved.format === FORMAT) copy = saved
      hydrated = true
    },

    // Tell me when the copy on the phone has been replaced.
    onChange(fn) { changed.add(fn); return () => changed.delete(fn) },

    // Is the database ahead of us? Offline, or the database unreachable: say
    // nothing and try again later.
    async check() {
      if (!hydrated) return
      let live
      try { live = await revision() } catch { return }
      if (live == null) return
      if (!copy) { await src.refresh().catch(() => {}); return }
      const was = src.behind
      src.behind = copy.revision !== live
      if (src.behind !== was) announce()
    },

    // Replace the copy on the phone with the database's. The revision is read
    // first: if the pack changes while we download, the number we save is the
    // older one, and the next check simply offers the update again.
    //
    // Saved first, then used: if the phone can't keep it, this throws and the
    // pack stays behind, so the pill comes back instead of pretending.
    async refresh() {
      const live = await revision()
      const { rows, meta: metaRows } = await download(live)
      const next = { format: FORMAT, revision: live, pack: build(rows, metaRows) }
      await idbSet(SHELF, next)
      copy = next
      src.behind = false
      announce()
      for (const fn of changed) fn()
    }
  }
  sources.push(src)
  return src
}

// Catch up every pack that's behind. A pack that fails stays behind, and the
// pill comes back; the reason is returned so it can be said out loud.
//   -> null when everything caught up, otherwise the first error
export async function refreshWords() {
  let failure = null
  await Promise.all(sources.filter(s => s.behind).map(s => s.refresh().catch(e => { failure = failure || e })))
  announce()
  return failure
}

// Load every copy off the phone. Done before the first screen is drawn, so the
// packs are there from the start.
export function hydrateRemotePacks() {
  return Promise.all(sources.map(s => s.hydrate()))
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
