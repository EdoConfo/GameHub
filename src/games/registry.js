// Games registry. To add a new game:
//   1. create src/games/<id>/index.js exporting the game contract
//   2. import it here and add it to the array below
//
// Game contract (default export):
//   {
//     id:          string  unique, matches the folder AND the address: a game
//                          lives at #/<id>, its screens at #/<id>/<phase>.
//                          Never 'players' or 'settings': those addresses are
//                          taken, and the fixed routes win (see router.js).
//     name:        string  shown on the hub card and top bar
//     description: string  short line on the hub card
//     icon:        string  emoji or short text glyph
//     glyph:       string  line icon name (shared/ui.js) shown on the hub circle
//     menu:        [{ title, sub, phase, glyph }]  the game's own menu wheel
//                  each phase is an address of its own: #/<id>/<phase>
//     table:       optional — "Gioca" opens the shared table in the hub:
//                  { min, options(ctx, { changed, open }) -> { node, check(n) },
//                    seat?(ctx, seat, i) -> { cls?, note? }, start(ctx) }
//                  open(title, content) shows a page of the game's own in the drawer
//                  seat dresses a chair before the match starts — Heads Up
//                  colours it by team; leave it out and chairs stay plain
//     mount(container, ctx, phase) -> optional cleanup function
//       container: HTMLElement to render into (already emptied)
//       ctx: { storage, players, table, stats, router, root, applyTheme }
//   }
import misterWhite from './mister-white/index.js'
import headsUp from './heads-up/index.js'
import quiplash from './quiplash/index.js'

export const games = [
  misterWhite,
  headsUp,
  quiplash
]

export function getGame(id) {
  return games.find(g => g.id === id) || null
}
