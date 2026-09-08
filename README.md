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

## Aggiungere pacchetti di parole

Dall'app: **Impostazioni ⚙ → Pacchetti di parole → + Aggiungi pacchetto**.

Due formati accettati:

**Formato righe** (una coppia per riga, `parola,parola-simile`):

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

I pacchetti custom restano salvati nel browser (`localStorage`) e sono attivabili/eliminabili.
Puoi tenere attivi più pacchetti insieme: le coppie vengono unite.

I pacchetti predefiniti stanno in [`src/packs/`](src/packs/) come file JSON
(`default.json`, `cibo.json`, `sport.json`, `film.json`, `animali.json`).
Per aggiungerne uno "di fabbrica": crea un nuovo `.json` con lo stesso schema
(`{ id, name, language, pairs }`) — viene caricato automaticamente al build.

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
       // ctx = { storage, players, packs, router, root, applyTheme }
       // disegna dentro container; ritorna una funzione di cleanup se serve
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
  shared/              storage, giocatori, pacchetti, helper UI (riusabili da ogni gioco)
  hub/                 home + impostazioni
  games/
    registry.js        elenco giochi
    mister-white/      engine (regole pure) + screens (UI)
  packs/               pacchetti di parole (JSON)
```

## Come si gioca a Mister White

- I **Civili** ricevono la parola segreta.
- Gli **Undercover** ricevono una parola simile ma diversa.
- **Mister White** non riceve nessuna parola e deve fingere.
- A turno ognuno dice a voce una parola collegata alla propria. Poi si vota chi eliminare.
- Vincono i Civili se smascherano tutti gli impostori; vincono gli impostori se sopravvivono;
  Mister White vince se, una volta eliminato, indovina la parola dei Civili.
