// A small key-value shelf in IndexedDB, for things too big for localStorage.
//
// localStorage has about 5 MB on Safari, shared by everything the app keeps —
// and player photos alone can fill it. IndexedDB gets far more room. It's
// asynchronous, so what's kept here is read once into memory at startup and
// written back when it changes.
const DB = 'gamehub'
const STORE = 'kv'
let opening = null

function open() {
  if (opening) return opening
  opening = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('no IndexedDB')); return }
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  opening.catch(() => { opening = null })
  return opening
}

function run(mode, fn) {
  return open().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const req = fn(tx.objectStore(STORE))
    tx.oncomplete = () => resolve(req && req.result)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error || new Error('aborted'))
  }))
}

export const idbGet = key => run('readonly', s => s.get(key))
export const idbSet = (key, value) => run('readwrite', s => s.put(value, key))
