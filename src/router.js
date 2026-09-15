// Hash-based router. Works on GitHub Pages (no server rewrites): everything
// after the # never reaches the server, so index.html is the only real page.
//
// The scheme reads like folders — the game first, then what you're doing in it:
//   #/                      home (the wheel of games)
//   #/<game>                that game's menu
//   #/<game>/table          its table, ready to start
//   #/<game>/<phase>        one of its screens (rules, words, stats, a match phase)
//   #/players               the players arc
//   #/players/<id>          one player's page
//   #/settings              settings
//
// Routes match in the order they were registered, so the fixed ones go in
// before #/<game>: a game may never be called "players" or "settings".
const routes = []
let notFound = () => {}

export function on(pattern, handler) {
  // pattern like '/game/:id' -> regex with named params
  const keys = []
  const re = new RegExp('^' + pattern.replace(/:[^/]+/g, m => {
    keys.push(m.slice(1))
    return '([^/]+)'
  }) + '$')
  routes.push({ re, keys, handler })
}

export function setNotFound(fn) { notFound = fn }

export function go(path) {
  const target = '#' + path
  if (location.hash === target) resolve()
  else location.hash = target
}

export function back() {
  // Prefer real history back; fall back to home.
  if (history.length > 1) history.back()
  else go('/')
}

function currentPath() {
  const h = location.hash.replace(/^#/, '')
  return h || '/'
}

function resolve() {
  const path = currentPath()
  for (const { re, keys, handler } of routes) {
    const m = path.match(re)
    if (m) {
      const params = {}
      keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]) })
      handler(params)
      return
    }
  }
  notFound()
}

export function start() {
  window.addEventListener('hashchange', resolve)
  if (!location.hash) location.hash = '#/'
  else resolve()
}
