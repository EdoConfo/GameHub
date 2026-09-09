# GameHub

Hub di giochi da tavolo per feste, da giocare tutti insieme su **un solo telefono** (pass-and-play).
Nessun server, nessun account: gira tutto nel browser e **funziona offline**.

Primo gioco incluso: **Mister White** (trova l'impostore che non conosce la parola).
L'architettura è pronta per aggiungerne altri (es. un gioco col telefono in fronte e il giroscopio).

## Cosa serve

- [Node.js](https://nodejs.org) 18+ (testato con Node 20/24)

## Sviluppo locale

```bash
npm install
npm run dev
```

Apri l'indirizzo che stampa Vite (di solito `http://localhost:5173/GameHub/`).

## Build di produzione

```bash
npm run build      # output in dist/
npm run preview    # anteprima della build
```

## Icone

Le icone PWA sono già generate in `public/icons/`. Per rigenerarle:

```bash
npm run icons
```

Sono create da uno script puro Node (`scripts/gen-icons.mjs`), senza dipendenze.

## Pubblicare su GitHub Pages

Il deploy è automatico via GitHub Actions a ogni push su `main`.

1. Vai su **Settings → Pages** del repository.
2. Alla voce **Build and deployment → Source** scegli **GitHub Actions**.
3. Fai push su `main`: il workflow `.github/workflows/deploy.yml` compila e pubblica.
4. Il sito sarà su `https://<utente>.github.io/GameHub/`.

### Base path

Il progetto è servito da una sottocartella (il nome del repo), quindi in
[`vite.config.js`](vite.config.js) è impostato:

```js
const BASE = '/GameHub/'
```

Se **rinomini il repository**, cambia `BASE` con `/<nuovo-nome>/` (barre iniziale e finale incluse).

## Installare offline (come app)

1. Apri il sito col browser del telefono.
2. Menu del browser → **Aggiungi alla schermata Home** (Android/Chrome) o **Condividi → Aggiungi a Home** (iOS/Safari).
3. Dopo la prima apertura funziona anche senza rete: il service worker mette in cache app e pacchetti di parole.

## Parole e pacchetti (per gioco)

I pacchetti di parole **non sono condivisi tra i giochi**: ogni gioco ha i suoi,
con un formato adatto. Le Impostazioni globali gestiscono solo tema e giocatori.

Per gestirli: entra nel gioco → **Gestisci parole**. Lì attivi/disattivi le
categorie, ne aggiungi di tue (salvate nel browser, `localStorage`, per quel
gioco) e le elimini. Ogni gioco ha il suo spazio di archiviazione separato.

### Mister White — coppie

Servono **coppie** (parola dei civili + parola simile per gli undercover).

**Formato righe** (`parola,parola-simile` per riga):

```
cane,lupo
pizza,focaccia
mare,lago
```

**Formato JSON**:

```json
{
  "pairs": [
    { "civilian": "cane", "undercover": "lupo" },
    { "civilian": "pizza", "undercover": "focaccia" }
  ]
}
```

Puoi tenere attive più categorie insieme: le coppie vengono unite in un pool.

Pacchetti "di fabbrica" in [`src/games/mister-white/packs/`](src/games/mister-white/packs/)
— JSON con schema `{ id, name, language, pairs }`. Un nuovo `.json` lì viene caricato al build.

### Heads Up — parole singole

Serve una **parola (o nome/frase) per riga**:

```
Spiderman
Pizza
Ballare la macarena
```

Formato JSON: `{ "words": ["Spiderman", "Pizza"] }`.
Pacchetti "di fabbrica" in [`src/games/heads-up/packs/`](src/games/heads-up/packs/)
— schema `{ id, name, language, words }`.

### Come funziona sotto

La logica comune (storage, attivazione, parsing, custom) sta in
[`src/shared/packStore.js`](src/shared/packStore.js): una factory `createPackStore`
che ogni gioco istanzia con un `namespace` proprio e un `codec` che descrive la
forma dei suoi item. La UI di gestione è riusabile
([`src/shared/packManagerScreen.js`](src/shared/packManagerScreen.js)) ma viene
aperta **dentro** il gioco, non dalle Impostazioni.

## Aggiungere un nuovo gioco

Ogni gioco è un modulo autonomo. Il resto dell'app (hub, router, impostazioni) non lo conosce.

1. Crea `src/games/<id>/index.js` con l'export di default (il "contratto"):

   ```js
   export default {
     id: 'heads-up',
     name: 'Heads Up',
     description: 'Indovina la parola sulla fronte.',
     icon: '📱',
     mount(container, ctx) {
       // ctx = { storage, players, router, root, applyTheme }
       // disegna dentro container; ritorna una funzione di cleanup se serve
       // (chiamata quando si lascia il gioco: ferma timer/sensori)
       // I pacchetti di parole li crea il gioco stesso (games/<id>/packs.js).
     }
   }
   ```

2. Registralo in [`src/games/registry.js`](src/games/registry.js):

   ```js
   import headsUp from './heads-up/index.js'
   export const games = [misterWhite, headsUp]
   ```

Fatto: la card compare nella home e la rotta `#/game/heads-up` funziona.

## Struttura

```
src/
  main.js              boot + rotte
  router.js            router hash (#/, #/game/<id>, #/settings)
  styles.css           token tema + UI condivisa
  shared/              storage, giocatori, packStore + packManagerScreen, helper UI
  hub/                 home + impostazioni (solo tema + giocatori)
  games/
    registry.js        elenco giochi
    mister-white/      engine + screens + packs.js + packs/*.json (coppie)
    heads-up/          screens + motion + packs.js + packs/*.json (parole)
```

## Come si gioca a Mister White

- I **Civili** ricevono la parola segreta.
- Gli **Undercover** ricevono una parola simile ma diversa.
- **Mister White** non riceve nessuna parola e deve fingere.
- A turno ognuno dice a voce una parola collegata alla propria. Poi si vota chi eliminare.
- Vincono i Civili se smascherano tutti gli impostori; vincono gli impostori se sopravvivono;
  Mister White vince se, una volta eliminato, indovina la parola dei Civili.
