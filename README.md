# GameHub

Party games you play together on **a single phone**, passing it around (pass-and-play).
No accounts, runs entirely in the browser, and **works offline** as an installable PWA.

Games included:

- **Mister White**: find the impostors among you before they blend in.
- **Heads Up**: hold the phone to your forehead and guess the word from your friends' clues.

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
3. After the first visit it works without a network: the service worker caches the app and its word packs.

When a new version is deployed, the app notices and offers to update.

## Word packs

Word packs are **per game**: each game has its own packs, in its own format and storage.
The global settings only handle theme, language and players.

To manage them, open a game → **Manage words**. There you can switch packs on and off,
create your own (saved in the browser's `localStorage`) and edit or delete them.

A pack holds one list per language, side by side. A pack without the current
language is hidden.

### Mister White: pairs

Each item is a **pair**: the Civilians' word and a similar word for the Undercovers.

The **Base** pack is not in the repository: it lives in a Supabase database
(schema in [`supabase/`](supabase/)). The app only reads it, downloads it once,
keeps it on the phone in IndexedDB so it plays offline, and offers to update it when
the database copy changes. The public key in
[`src/shared/supabase.js`](src/shared/supabase.js) is read-only by design.

### Heads Up: single words

Each item is **one word (or name, or phrase)**. The built-in packs are in
[`src/games/heads-up/packs/`](src/games/heads-up/packs/), one JSON file per pack:

```json
{
  "id": "cibo",
  "icon": "food",
  "name":  { "it": "Cibo & Bevande", "en": "Food & Drink" },
  "words": { "it": ["Pizza", "Sushi"], "en": ["Pizza", "Sushi"] }
}
```

A new `.json` file in that folder is picked up at build time.

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
    heads-up/          screens + motion + packs.js + packs/*.json
supabase/              database schema for the remote packs
```

## How to play Mister White

- **Civilians** get the secret word.
- **Undercovers** get a similar but different word.
- **Mister White** gets no word at all and has to bluff.
- In turn, everyone says one word related to their own. Then the group votes someone out.
- Civilians win by unmasking every impostor; the impostors win by surviving.
  Mister White, once voted out, can still win by guessing the Civilians' word.

## License

[MIT](LICENSE)
