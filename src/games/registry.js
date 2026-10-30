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
//     places:      optional — screens of the game's own that aren't the shared
//                  table ("Gioca"): a room, a way into one, a match on one phone.
//                  { [phase]: (scene, ctx) -> optional cleanup }
//                  A menu bead whose phase is here turns circle B into a table
//                  and hands it over, the same morph as "Gioca"; the game never
//                  builds a screen of its own (docs/SCENE.md).
//                  scene: { stage, exit(), header({ code, live }), onSeat(fn), onBack(fn) }
//     panel:       optional — true for a game whose places have no use for a
//                  table (Battaglia navale): circle B swells out of the frame
//                  and a still panel takes the screen under the header instead.
//                  scene.panel replaces scene.stage: panel.present(node, { key })
//                    stage:  the table stage (shared/tableStage.js) — seats on
//                            stage.view, pages with stage.present(node, { key }),
//                            one-off panels with stage.openSheet
//                    exit:   fold back into the game's circle, menu beads riding in
//                    header: what the hub's header shows besides the name (a code)
//                    onSeat: taps on a seat · onBack: the arrow and the swipe home
//                            (leave it out and they simply exit)
//     mount(container, ctx, phase) -> optional cleanup function
//       container: HTMLElement to render into (already emptied)
//       ctx: { storage, players, table, stats, router, root, applyTheme }
//   }
import misterWhite from './mister-white/index.js'
import headsUp from './heads-up/index.js'
import quiplash from './quiplash/index.js'
import battleship from './battleship/index.js'

export const games = [
  misterWhite,
  headsUp,
  quiplash,
  battleship
]

export function getGame(id) {
  return games.find(g => g.id === id) || null
}
