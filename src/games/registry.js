// Games registry. To add a new game:
//   1. create src/games/<id>/index.js exporting the game contract
//   2. import it here and add it to the array below
//
// Game contract (default export):
//   {
//     id:          string  unique, matches the folder + route #/game/<id>
//     name:        string  shown on the hub card and top bar
//     description: string  short line on the hub card
//     icon:        string  emoji or short text glyph
//     glyph:       string  line icon name (shared/ui.js) shown on the hub circle
//     menu:        [{ title, sub, phase, glyph }]  the game's own menu wheel
//     table:       optional — "Gioca" opens the shared table in the hub:
//                  { min, options(ctx, onChange) -> { node, check(n) }, start(ctx) }
//     mount(container, ctx, phase) -> optional cleanup function
//       container: HTMLElement to render into (already emptied)
//       ctx: { storage, players, table, stats, router, root, applyTheme }
//   }
import misterWhite from './mister-white/index.js'
import headsUp from './heads-up/index.js'

export const games = [
  misterWhite,
  headsUp
]

export function getGame(id) {
  return games.find(g => g.id === id) || null
}
