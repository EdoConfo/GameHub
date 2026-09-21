# GameHub

Party games you play together on **a single phone**, passing it around (pass-and-play).
No accounts, runs entirely in the browser, and **works offline** as an installable PWA.

Games included:

- **Mister White**: find the impostors among you before they blend in.
- **Heads Up**: in teams. Hold the phone to your forehead and guess the word from your team's clues.

The interface is available in Italian and English.

Play it at **https://edoconfo.github.io/GameHub/**

## Requirements

- [Node.js](https://nodejs.org) 18+ (tested with Node 20 and 24)

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:5173/GameHub/` (the port is fixed).

## Production build

```bash
npm run build      # output in dist/
npm run preview    # preview the build
```

## Icons

The PWA icons are already generated in `public/icons/`. To regenerate them:

```bash
npm run icons
```

They are created by a plain Node script (`scripts/gen-icons.mjs`) with no dependencies.

## Deploying to GitHub Pages

Every push to `main` is deployed automatically by GitHub Actions.

1. Open the repository's **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Push to `main`: the `.github/workflows/deploy.yml` workflow builds and publishes the site.
4. The site is served at `https://<user>.github.io/GameHub/`.

### Base path

The app is served from a subfolder (the repository name), so
[`vite.config.js`](vite.config.js) sets:

```js
const BASE = '/GameHub/'
```

If you **rename the repository**, change `BASE` to `/<new-name>/` (keep the leading and trailing slashes).

## Installing as an app

1. Open the site in your phone's browser.
2. Browser menu → **Add to Home screen** (Android/Chrome), or **Share → Add to Home Screen** (iOS/Safari).
3. After the first visit it works without a network: the service worker caches the app, and the words are kept on the phone once downloaded.

When a new version is deployed, the app notices and offers to update.

## Word packs

Word packs are **per game**: each game has its own packs, in its own format and storage.
The global settings only handle theme, language and players.

To manage them, open a game → **Manage words**. There you can switch packs on and off,
create your own (saved in the browser's `localStorage`) and edit or delete them.

A pack holds one list per language, side by side. A pack without the current
language is hidden.

Neither game ships its words. Both live in a Supabase database (schema in
[`supabase/`](supabase/)): the app only reads them, downloads them the first time
it sees a network, keeps them on the phone in IndexedDB so they play offline, and
offers to update them when the database copy changes. The public key in
[`src/shared/supabase.js`](src/shared/supabase.js) is read-only by design — the
database's own rules allow it nothing else.

Until that first download there is nothing to play with, and the game says so
instead of showing an empty list.

The built-in packs are played but not opened: their words stay out of sight, so
nobody at the table has read them first. Packs you write yourself are yours to
edit, and sit beside them.

### Mister White: pairs

Each item is a **pair**: the Civilians' word and a similar word for the
Undercovers. There is one built-in pack, **Base**, in the `mw_base` table.

It used to be five themed packs. Picking one told the table what the word was
about, which hands Mister White — the one player without a word — most of the
answer. A pool with no theme gives nothing away.

### Heads Up: single words

Each item is **one word (or name, or phrase)**, and the built-in packs are the
categories: Animali, Cibo & Bevande, Film & Serie, VIP & Personaggi, Da mimare.
They live in two tables, `hu_packs` (the categories and their names) and
`hu_words` (the words in them).

The categories stay, where Mister White's themes went away, because here the
category *is* the game: you pick "Animali" and everyone knows it.

In both tables one row carries every language at once, and no column may be
empty — so a pair or a word exists in all languages or in none, and every
language plays the same list, with the same count.

### How it works

The shared logic (storage, enabling, custom packs, languages) lives in
[`src/shared/packStore.js`](src/shared/packStore.js): a `createPackStore` factory
that each game instantiates with its own `namespace` and a `codec` describing the
shape of its items. The editor UI ([`src/shared/packEditor.js`](src/shared/packEditor.js))
is shared, but it is opened **from inside** each game, not from the settings.

## Adding a new game

Each game is a self-contained module. The rest of the app (hub, router, settings) knows nothing about it.

1. Create `src/games/<id>/index.js` with a default export (the game contract):

   ```js
   export default {
     id: 'my-game',
     name: 'My Game',
     description: 'One line for the hub card.',
     icon: '🎲',
     glyph: 'words',
     menu: [{ title: 'Play', sub: '', phase: 'play', glyph: 'play' }],
     mount(container, ctx, phase) {
       // ctx = { storage, players, table, stats, router, root, applyTheme }
       // render into container; return a cleanup function if needed
       // (called when leaving the game: stop timers and sensors)
     }
   }
   ```

   The full contract, including the optional shared `table`, is documented in
   [`src/games/registry.js`](src/games/registry.js).

2. Register it in [`src/games/registry.js`](src/games/registry.js):

   ```js
   import myGame from './my-game/index.js'
   export const games = [misterWhite, headsUp, myGame]
   ```

That's it: the game shows up in the hub and `#/my-game` works.

## Project structure

```
src/
  main.js              boot + routes
  router.js            hash router (#/, #/<game>, #/<game>/<phase>, #/players, #/settings)
  styles.css           theme tokens + shared UI
  shared/              storage, i18n, players, table, pack store + editor, PWA update, Supabase client
  hub/                 home, players, shared table scene
  games/
    registry.js        list of games
    mister-white/      engine + match + packs.js (Base from Supabase)
    heads-up/          match (teams, turns) + screens + motion + teams.js + packs.js
supabase/              database schema for the remote packs
```

## How to play Heads Up

- Sit everyone at the table and **split them into teams** — the seat colour says
  who plays with whom. A team needs at least two players: one holds the phone,
  the others give the clues.
- A **turn** is one team's: the phone goes to one of them, on the forehead with
  the screen facing out, and the rest shout clues until the time runs out.
  Tilt down for a right answer, up to pass — or tap the screen, right and left.
- When every team has had its turn the **standings** come up, with Play again
  right there. One turn each by default; two or three in the drawer if you want
  a longer game.
- The phone rotates inside the team from turn to turn, so it is never always the
  same person holding it.

## How to play Mister White

- **Civilians** get the secret word.
- **Undercovers** get a similar but different word.
- **Mister White** gets no word at all and has to bluff.
- In turn, everyone says one word related to their own. Then the group votes someone out.
- Civilians win by unmasking every impostor; the impostors win by surviving.
  Mister White, once voted out, can still win by guessing the Civilians' word.

## License

[MIT](LICENSE)
