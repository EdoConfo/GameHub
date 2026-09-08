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
//     mount(container, ctx) -> optional cleanup function
//       container: HTMLElement to render into (already emptied)
//       ctx: { storage, players, packs, router, root }
//   }
import misterWhite from './mister-white/index.js'

export const games = [
  misterWhite
  // headsUp,  <-- next game drops in here
]

export function getGame(id) {
  return games.find(g => g.id === id) || null
}
