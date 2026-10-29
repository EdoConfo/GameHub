# The scene: one world, one camera

GameHub is not a set of screens. It is **one world, much bigger than the
phone, and the screen is a camera moving over it**. Every game, every page,
every step of a match is a *place* in that world. Going somewhere means the
camera travels there; it never means the world is swapped for another one.

The one rule everything else follows from:

> **If something is on screen and something happens, it cannot disappear
> all at once.** Whatever you were looking at stays where it was, turns
> into what comes next, or leaves the frame moving — and you can tell where
> it went.

## The rules

1. **The world is mounted once.** `#app` holds a single `.canvas` for the
   whole life of the app. No route and no game may `clear(root)`, build a
   second `.canvas`, or lay a full-screen fixed layer (`.guest`, `.game-root`)
   over the world. A game is given a place *in* the world, never the screen.

2. **Every screen is a place, with coordinates.** Changing place is a camera
   move (a pan; a zoom when the place is inside something already on
   screen), with `--pan-ease`. The address bar names the place and is written
   with `replaceState` as the camera arrives: navigating never rebuilds the
   world.

3. **Everything visible has a fate.** At the start of any transition, each
   thing on screen does exactly one of these:
   - **it stays**: it belongs to the world, moves 1:1 with the camera and
     leaves the frame only because the camera moved away from it;
   - **it becomes the next thing**: a morph — circle B into the table, the
     tapped bead into the header title, the drawer changing height;
   - **it leaves, travelling**: in a direction that agrees with the camera
     (it goes the way the world is going), over the same duration.

   Forbidden: an opacity cut, `replaceChildren` on a visible area with no
   motion, fading to empty and then fading a new thing in.
   The only exception is **text inside an element that stays** (a label, a
   count, a button's caption): it may change in place with a short
   crossfade, because its container does not move.

4. **Back is the same movement, reversed.** Leaving a place and coming back
   finds it where it was, in the state you left it, for the whole session.
   The camera never "jumps" to a place without travelling.

5. **Neighbours are in sight.** Places are close enough that during a move
   you see the one you are leaving and the one you are reaching at the same
   time: nothing arrives out of the void. A game's places sit next to that
   game's circle (circle B), so entering the game is a short trip from its
   menu.

6. **What persists, persists.** The header is one band for the whole app: its
   content changes by sliding in the camera's direction, it is never rebuilt
   by a game. The table, once on screen, glides to its new place and size; it
   is never torn down and built again elsewhere. The drawer, once up,
   changes height; it never slides out and back in.

7. **Inside a place, steps change content through a container that stays.**
   A match moving from one phase to the next swaps what the drawer holds
   (`stage.present`, `setDrawer`) or moves the camera to the next place;
   it does not rebuild the place.

8. **Overlays come from an edge and go back to it.** Sheets and modals rise
   from below and return below; the scene stays visible under them.

9. **Privacy is a motion too.** Pass-and-play screens that must hide the
   board (Battaglia navale between two admirals, a Mister White card) cover it
   with something that *travels over it* — a curtain, a card turning — never
   with a cut to a blank screen.

## How a game uses the world

A game does not own the screen; the hub hands it places.

- `ctx.scene.place(id)` → a window-sized host in the world, next to this
  game's circle. The game renders into it.
- `ctx.scene.go(id)` → the camera travels there (and writes the address).
- `ctx.scene.header({ title, back })` → the shared header shows this, sliding.
- `ctx.scene.back()` → the reverse of the last move.
- Table games keep using the hub's table: the match is played on the same
  table that circle B became, not on a copy of it.

Before shipping any new screen or transition, check it against the rule:
pause the transition at its first frame and at its middle frame. Everything
in the first frame must still be visible in the middle one, moved or
changed — not gone.

## Where the code still breaks the rule

Known places to bring into line (as of this document):

- `src/main.js` — every route does `clear(root)` and rebuilds the hub;
  `mountGame` replaces the whole world with a `.game-root` that slides in
  (`game-in` in `styles.css`). Every entry into a game and every return is a
  cut.
- `ctx.exitToMenu` is called by every game but never defined, so leaving a
  match goes through the router and rebuilds the hub from scratch.
- `src/games/battleship/screens.js` `frame()` — a fixed `.guest` layer with
  its own header, cleared on every step (pick → cover → place → battle):
  each step is a cut, and so are Crea stanza / Entra / Un telefono.
- `src/games/quiplash/` — the room and guest screens (`NET_PHASES`,
  `guest.js`) do the same.
- `src/games/heads-up/index.js` — `FULL_PHASES` tear the table down for the
  countdown and the turn.
- Mister White, Quiplash, Heads Up `tableScreen()` — the match builds a
  second `.canvas` with its own table; it looks continuous only because it
  starts from the last geometry, and the hub's circles are gone behind it.
