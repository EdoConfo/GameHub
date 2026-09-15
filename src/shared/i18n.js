// Interface language. One dictionary per language, flat dotted keys.
//
// Rules of the house:
//   - every user-visible string lives here, never inline in a screen
//   - t('key', { name }) fills {name} placeholders
//   - a missing key falls back to Italian, then to the key itself, so a
//     half-translated language never renders an empty screen
//
// Word packs are NOT here: they carry their own languages (see packStore.js).
import * as storage from './storage.js'

const KEY = 'lang'

// Order matters: the Lingua bead in settings cycles through this list.
export const LANGS = ['it', 'en']
export const LANG_NAMES = { it: 'Italiano', en: 'English' }
// For toLocaleDateString and localeCompare.
export const LOCALES = { it: 'it-IT', en: 'en-GB' }

const DICT = {
  it: {
    'common.back': 'Indietro',
    'common.forward': 'Avanti',
    'common.cancel': 'Annulla',
    'common.save': 'Salva',
    'common.delete': 'Elimina',
    'common.edit': 'Modifica',
    'common.done': 'Fatto',
    'common.new': 'Nuovo',
    'common.menu': 'Menu',
    'common.restore': 'Ripristina',
    'common.whatItDoes': 'Cosa fa',

    'hub.players': 'Giocatori',
    'hub.settings': 'Impostazioni',

    'settings.theme': 'Tema',
    'settings.dark': 'Scuro',
    'settings.light': 'Chiaro',
    'settings.theme.system': 'Sistema',
    'settings.theme.light': 'Chiaro',
    'settings.theme.dark': 'Scuro',
    'settings.language': 'Lingua',
    'settings.offline': 'Offline',
    'settings.offlineSub': 'Installabile · funziona senza rete',

    'players.profile': 'Profilo',
    'players.addPlayer': 'Aggiungi giocatore',
    'players.newTitle': 'Nuovo giocatore',
    'players.editTitle': 'Modifica giocatore',
    'players.loadPhoto': 'Carica foto',
    'players.removePhoto': 'Rimuovi foto',
    'players.namePlaceholder': 'Nome',
    'players.color': 'Colore',
    'players.emojiOptional': 'Emoji (opzionale)',
    'players.nameRequired': 'Serve un nome.',
    'players.badImage': 'Immagine non valida',

    'player.perGame': 'Per gioco',
    'player.recent': 'Attività recente',
    'player.emptyFeed': 'Nessuna partita ancora. Gioca per riempire il feed!',
    'player.win': 'Vinta',
    'player.loss': 'Persa',
    'player.deleteTitle': 'Eliminare {name}?',
    'player.deleteBody': 'Il giocatore viene rimosso dal roster. Le statistiche registrate restano nei giochi.',

    'stats.title': 'Statistiche',
    'stats.played': 'Partite',
    'stats.won': 'Vittorie',
    'stats.winRate': 'Win rate',
    'stats.player': 'Giocatore',
    'stats.playedShort': 'Giocate',
    'stats.wonShort': 'Vinte',
    'stats.empty': 'Ancora nessuna partita registrata. Gioca per vedere le statistiche!',

    'time.now': 'ora',
    'time.min': '{n}m fa',
    'time.hour': '{n}h fa',
    'time.day': '{n}g fa',

    'table.seatFree': 'Posto libero',
    'table.drawerToggle': 'Apri o chiudi il cassetto',
    'table.sheetClose': 'Chiudi',
    'table.free': 'libero',
    'table.seat': 'posto',
    'table.seats': 'posti',
    'table.addSeat': 'Sedia',
    'table.addPlayer': 'Giocatore',
    'table.swapHint': 'Su un giocatore lo scambi, tra due lo inserisci',
    'table.rotateHint': 'Trascina il tavolo per girarlo',
    'table.start': 'Inizia',
    'table.needSeats': 'Servono almeno {n} posti',
    'table.whoSits': 'Chi si siede?',
    'table.pickForSeat': 'Scegli chi siede qui, o lascialo libero: chi lo trova si presenta quando riceve il telefono.',
    'table.pickProfile': 'Scegli un profilo o creane uno nuovo.',
    'table.allSeated': 'Tutti i profili sono già al tavolo: creane uno nuovo.',
    'table.playersHint': 'Tocca chi si siede: il pannello resta aperto, così li aggiungi tutti in fila. L’ordine lo sistemi dopo, sul tavolo.',
    'table.free.action': 'Libera',
    'table.remove': 'Togli',

    'packs.title': 'Parole',
    'packs.section': 'Pacchetti',
    'packs.new': '+ Nuovo pacchetto',
    'packs.newTitle': 'Nuovo pacchetto',
    'packs.editTitle': 'Modifica pacchetto',
    'packs.namePlaceholder': 'Nome pacchetto',
    'packs.use': 'Usa {name}',
    'packs.tagCustom': ' · tuo',
    'packs.tagModified': ' · modificato',
    'packs.deleteSure': 'Elimina davvero',
    'packs.deleted': 'Eliminato “{name}”',
    'packs.restored': 'Ripristinato com’era',
    'packs.saved': 'Salvato “{name}” ({n} {unit})',
    'packs.added': 'Aggiunto “{name}” ({n} {unit})',
    'packs.nameRequired': 'Dai un nome al pacchetto.',
    'packs.emptyText': 'Il testo è vuoto.',
    'packs.badJson': 'JSON non valido. Controlla la sintassi.',
    'packs.missingField': 'JSON senza campo "{field}" valido.',
    'packs.notFound': 'Pacchetto non trovato.',
    'packs.unit.items': 'voci',

    'mw.name': 'Mr White',
    'mw.description': 'Trova l’impostore che non conosce la parola.',
    'mw.menu.play': 'Gioca',
    'mw.menu.playSub': 'Nuova partita',
    'mw.menu.words': 'Parole',
    'mw.menu.wordsSub': 'Pacchetti e coppie',
    'mw.menu.rules': 'Come si gioca',
    'mw.menu.rulesSub': 'Regole e ruoli',
    'mw.menu.stats': 'Statistiche',
    'mw.menu.statsSub': 'Partite e vittorie',

    'mw.unit.pairs': 'coppie',
    'mw.packsHelp': 'Coppie di parole: quella dei civili e una simile per gli Undercover. Tocca un pacchetto per rinominarlo o cambiarne le coppie. Quali usare lo scegli al tavolo, prima di ogni partita.',
    'mw.packsPlaceholder': 'Una coppia per riga:\ncane,lupo\npizza,focaccia\n\n…oppure JSON: { "pairs": [ { "civilian": "cane", "undercover": "lupo" } ] }',
    'mw.packsEmpty': 'Nessuna coppia valida. Formato: "parola,parola-simile" per riga.',

    'mw.role.civile': 'Civile',
    'mw.role.undercover': 'Undercover',
    'mw.role.mrwhite': 'Mr White',
    'mw.roles.civili': 'Civili',
    'mw.roles.impostori': 'Impostori',

    'mw.rules.title': 'Come si gioca',
    'mw.rules.rolesSection': 'Ruoli',
    'mw.rules.civili': 'Ricevono la parola segreta.',
    'mw.rules.undercover': 'Ricevono una parola simile ma diversa.',
    'mw.rules.mrwhite': 'Non riceve nessuna parola: deve fingere di saperla.',
    'mw.rules.goddess': 'Dea della giustizia',
    'mw.rules.goddessDesc': 'Estratta a caso tra tutti quando la distribuzione è finita. Se al voto c’è un pareggio, decide lei chi eliminare. Se viene eliminata, se ne estrae un’altra.',
    'mw.rules.countSection': 'Quanti impostori',
    'mw.rules.minority': 'Sempre in minoranza',
    'mw.rules.minorityDesc': 'I civili devono essere più degli impostori (Undercover + Mr White): con 3–4 giocatori 1 impostore, con 5–6 fino a 2, con 7–8 fino a 3, e così via.',
    'mw.rules.suggested': 'Consigliati',
    'mw.rules.suggestedDesc': 'Circa 4 impostori ogni 10 giocatori: un Mr White (due da 11 in su), il resto Undercover.',
    'mw.rules.flowSection': 'Come si svolge',
    'mw.rules.step0': '0 · Il tavolo',
    'mw.rules.step0Desc': 'Disponete i posti come siete seduti. Chi trova un posto libero si presenta quando riceve il telefono.',
    'mw.rules.step1': '1 · Distribuzione',
    'mw.rules.step1Desc': 'Il telefono fa il giro del tavolo: ognuno vede in privato la sua parola (o scopre di essere Mr White).',
    'mw.rules.step2': '2 · Indizi',
    'mw.rules.step2Desc': 'A turno, in senso orario, ognuno dice a voce una parola collegata alla propria. Non scriverla. Non comincia mai un Mr White.',
    'mw.rules.step3': '3 · Votazione',
    'mw.rules.step3Desc': 'Discutete ed eliminate un sospetto toccandolo sul tavolo. Si scopre il suo ruolo. In caso di pareggio decide la Dea della giustizia.',
    'mw.rules.winSection': 'Chi vince',
    'mw.rules.winCivili': 'Se eliminano tutti gli impostori (Undercover + Mr White).',
    'mw.rules.winImpostori': 'Se resistono finché resta un solo civile.',
    'mw.rules.winMrWhite': 'Se, una volta eliminato, indovina la parola dei civili.',

    'mw.setup.min3': 'Servono almeno 3 giocatori.',
    'mw.setup.max20': 'Massimo 20 giocatori.',
    'mw.setup.needImpostor': 'Serve almeno un impostore.',
    'mw.setup.tooMany': 'Troppi impostori: i civili devono essere di più.',
    'mw.setup.pickPack': 'Scegli almeno un pacchetto di parole',
    'mw.opt.less': 'Meno {label}',
    'mw.opt.more': 'Più {label}',
    'mw.opt.civili': 'Civili',
    'mw.opt.characters': 'Personaggi',
    'mw.opt.charactersHint': 'I civili sono tutti gli altri: quelli che restano dopo gli impostori. Tocca ? per sapere cosa fa un ruolo.',
    'mw.opt.words': 'Parole',
    'mw.opt.choose': 'Scegli',
    'mw.opt.nPacks': '{n} pacchetti',
    'mw.opt.packsHint': 'Scegli da quali pacchetti pescare la coppia. Si creano e si modificano da “Parole” nel menu del gioco.',
    'mw.opt.nPairs': '{n} coppie',

    'mw.extra.meme': 'Mr Meme',
    'mw.extra.memeDesc': 'A ogni giro di indizi tocca a uno a caso: descrive la sua parola solo a gesti, senza parlare.',
    'mw.extra.lovers': 'Innamorati',
    'mw.extra.loversDesc': 'Due giocatori si innamorano all’inizio, e lo sanno. Se uno viene eliminato l’altro lo segue, e si scopre solo in quel momento.',
    'mw.extra.revenger': 'Vendicatore',
    'mw.extra.revengerDesc': 'Quando viene eliminato si porta via un altro giocatore, scelto da lui. Vale una volta sola.',
    'mw.extra.needPlayers': 'Serve da {n} giocatori in su.',
    'mw.extra.section': 'In più',

    'mw.deal.loverOf': 'Sei innamorato di {name}.',
    'mw.deal.revenger': 'Sei il Vendicatore: se ti eliminano, ne porti via uno con te.',

    'mw.play.meme': 'Tocca a {name}: descrive la sua parola a gesti, senza parlare.',
    'mw.play.memeNote': 'gesti',
    'mw.play.loversOut': '{a} e {b} erano innamorati.',

    'mw.revenge.kicker': 'La vendetta di {name}',
    'mw.revenge.hint': 'Tocca sul tavolo chi si porta via.',
    'mw.revenge.pick': 'Scegli chi',
    'mw.revenge.confirm': 'Porta via {name}',
    'mw.revenge.note': 'vendetta',

    'mw.deal.counter': 'parole',
    'mw.deal.passTo': 'Passa il telefono a',
    'mw.deal.onlyYou': 'Solo tu devi vedere lo schermo.',
    'mw.deal.seeWord': 'Vedi la tua parola',
    'mw.deal.youAreMrWhite': 'Sei Mr White',
    'mw.deal.mrWhiteHint': 'Non conosci la parola: fingi di saperla.',
    'mw.deal.yourWord': 'La tua parola è',
    'mw.deal.hideAndStart': 'Nascondi e iniziate',
    'mw.deal.hideAndPass': 'Nascondi e passa',

    'mw.join.freeSeat': 'Posto libero',
    'mw.join.who': 'Chi sei?',
    'mw.join.pickOrCreate': 'Prima della parola, presentati: tocca il tuo profilo o creane uno.',
    'mw.join.createOnly': 'Prima della parola, crea il tuo profilo.',
    'mw.join.createMine': 'Crea il mio profilo',

    'mw.goddess.kicker': 'Dea della giustizia',
    'mw.goddess.short': 'Dea',
    'mw.goddess.hint': 'Se al voto c’è un pareggio, decide lei chi eliminare.',
    'mw.goddess.start': 'Iniziamo',
    'mw.goddess.new': '{name} è la nuova Dea della giustizia.',

    'mw.play.inGame': 'in gioco',
    'mw.play.starts': 'inizia',
    'mw.play.wasRole': '{name} era {role}',
    'mw.play.title': 'Indizi',
    'mw.play.hint': 'Inizia {name}, poi in senso orario: ognuno dice a voce una parola collegata alla propria.',
    'mw.play.toVote': 'Vai alla votazione',

    'mw.vote.title': 'Votazione',
    'mw.vote.hint': 'Discutete e votate, poi toccate sul tavolo chi eliminare. In caso di pareggio decide {name}.',
    'mw.vote.clues': 'Indizi',
    'mw.vote.tie': 'Pareggio',
    'mw.vote.noTie': 'Niente pareggio',
    'mw.vote.tieDecides': 'Decide {name}',
    'mw.vote.tieHint': 'La Dea della giustizia sceglie chi eliminare: toccalo sul tavolo.',
    'mw.vote.goddessEliminates': '{name} elimina',
    'mw.vote.eliminate': 'Eliminare',
    'mw.vote.guessTitle': '{name} è Mr White!',
    'mw.vote.guessBody': 'Ultima possibilità: indovina la parola dei civili per vincere.',
    'mw.vote.guessPlaceholder': 'La parola dei civili è…',
    'mw.vote.guessWrong': 'Non indovina',
    'mw.vote.guessConfirm': 'Conferma',

    'mw.results.civiliWin': 'Vincono i Civili',
    'mw.results.civiliWinSub': 'Tutti gli impostori sono stati smascherati.',
    'mw.results.mrWhiteWin': 'Vince Mr White',
    'mw.results.mrWhiteWinSub': '{name} ha indovinato la parola.',
    'mw.results.impostoriWin': 'Vincono gli Impostori',
    'mw.results.impostoriWinSub': 'Sono sopravvissuti fino alla fine.',
    'mw.results.replay': 'Rigioca',
    'mw.results.changeTable': 'Cambia tavolo',
    'mw.results.recCivili': 'Vittoria Civili',
    'mw.results.recMrWhite': 'Mr White ha indovinato',
    'mw.results.recImpostori': 'Vittoria Impostori',

    'mw.leave.title': 'Uscire dalla partita?',
    'mw.leave.body': 'Il round in corso andrà perso.',
    'mw.leave.stay': 'Resta',
    'mw.leave.exit': 'Esci',

    'hu.name': 'Heads Up',
    'hu.description': 'Telefono in fronte: indovina la parola dagli indizi.',
    'hu.menu.play': 'Gioca',
    'hu.menu.playSub': 'Nuova partita',
    'hu.menu.words': 'Parole',
    'hu.menu.wordsSub': 'Categorie',
    'hu.menu.rules': 'Come si gioca',
    'hu.menu.rulesSub': 'Regole',

    'hu.unit.words': 'parole',
    'hu.packsHelp': 'Parole e nomi da indovinare. Attiva le categorie da giocare; puoi aggiungerne di tue.',
    'hu.packsPlaceholder': 'Una parola per riga:\nSpiderman\nPizza\nBallare la macarena\n\n…oppure JSON: { "words": ["Spiderman", "Pizza"] }',
    'hu.packsEmpty': 'Nessuna parola valida. Scrivi una parola per riga.',

    'hu.rules.title': 'Come si gioca',
    'hu.rules.shortSection': 'In breve',
    'hu.rules.phone': 'Telefono in fronte',
    'hu.rules.phoneDesc': 'Un giocatore tiene il telefono sulla fronte, schermo verso gli altri.',
    'hu.rules.clues': 'Gli altri danno indizi',
    'hu.rules.cluesDesc': 'Descrivono la parola senza dirla, finché non la indovini.',
    'hu.rules.tilt': 'Inclina',
    'hu.rules.tiltDesc': 'Giù = indovinata, su = passo. In alternativa tocca lo schermo (destra = giusto, sinistra = passo).',
    'hu.rules.goalSection': 'Obiettivo',
    'hu.rules.goal': 'Più parole possibili',
    'hu.rules.goalDesc': 'Indovinane il più possibile prima che scada il tempo.',

    'hu.setup.category': 'Categoria',
    'hu.setup.noCategory': 'Nessuna categoria attiva. Aggiungine o attivane una in “Gestisci parole”.',
    'hu.setup.manage': 'Gestisci parole',
    'hu.setup.duration': 'Durata',
    'hu.setup.controls': 'Comandi',
    'hu.setup.tiltHint': 'Inclina il telefono in giù = giusto, in su = passo. In alternativa tocca lo schermo: destra = giusto, sinistra = passo.',
    'hu.setup.noSensor': 'Sensore non disponibile: tocca lo schermo — destra = giusto, sinistra = passo.',
    'hu.setup.invert': 'Inverti inclinazione',
    'hu.setup.continue': 'Continua',

    'hu.ready.title': 'Pronti?',
    'hu.ready.step1': 'Gira il telefono in orizzontale.',
    'hu.ready.step2': 'Tienilo sulla fronte, schermo verso gli altri.',
    'hu.ready.step3': 'Gli altri ti danno indizi. Indovina la parola!',
    'hu.ready.step4': 'Giù = giusto · Su = passo (oppure tocca destra/sinistra).',
    'hu.ready.start': 'Avvia',
    'hu.countdown.go': 'Via!',

    'hu.play.hint': '← passo · giusto →',
    'hu.play.noSensorHint': 'Sensore assente — tocca: ← passo · giusto →',
    'hu.play.tapHint': 'Tocca: ← passo · giusto →',

    'hu.results.title': 'Risultato',
    'hu.results.guessed': '{n} indovinate',
    'hu.results.passedLine': '{n} passate · {s}s',
    'hu.results.guessedSection': 'Indovinate ✅',
    'hu.results.passedSection': 'Passate ⏭️',
    'hu.results.empty': 'Nessuna parola giocata.',
    'hu.results.replay': 'Rigioca',
    'hu.results.changeCategory': 'Cambia categoria',
    'hu.results.home': 'Torna alla home'
  },

  en: {
    'common.back': 'Back',
    'common.forward': 'Forward',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.done': 'Done',
    'common.new': 'New',
    'common.menu': 'Menu',
    'common.restore': 'Restore',
    'common.whatItDoes': 'What it does',

    'hub.players': 'Players',
    'hub.settings': 'Settings',

    'settings.theme': 'Theme',
    'settings.dark': 'Dark',
    'settings.light': 'Light',
    'settings.theme.system': 'System',
    'settings.theme.light': 'Light',
    'settings.theme.dark': 'Dark',
    'settings.language': 'Language',
    'settings.offline': 'Offline',
    'settings.offlineSub': 'Installable · works with no network',

    'players.profile': 'Profile',
    'players.addPlayer': 'Add a player',
    'players.newTitle': 'New player',
    'players.editTitle': 'Edit player',
    'players.loadPhoto': 'Upload photo',
    'players.removePhoto': 'Remove photo',
    'players.namePlaceholder': 'Name',
    'players.color': 'Colour',
    'players.emojiOptional': 'Emoji (optional)',
    'players.nameRequired': 'A name is required.',
    'players.badImage': 'Invalid image',

    'player.perGame': 'By game',
    'player.recent': 'Recent activity',
    'player.emptyFeed': 'No games yet. Play a round to fill the feed!',
    'player.win': 'Won',
    'player.loss': 'Lost',
    'player.deleteTitle': 'Delete {name}?',
    'player.deleteBody': 'The player leaves the roster. Recorded stats stay in the games.',

    'stats.title': 'Stats',
    'stats.played': 'Games',
    'stats.won': 'Wins',
    'stats.winRate': 'Win rate',
    'stats.player': 'Player',
    'stats.playedShort': 'Played',
    'stats.wonShort': 'Won',
    'stats.empty': 'No games recorded yet. Play a round to see the stats!',

    'time.now': 'now',
    'time.min': '{n}m ago',
    'time.hour': '{n}h ago',
    'time.day': '{n}d ago',

    'table.seatFree': 'Free seat',
    'table.drawerToggle': 'Open or close the drawer',
    'table.sheetClose': 'Close',
    'table.free': 'free',
    'table.seat': 'seat',
    'table.seats': 'seats',
    'table.addSeat': 'Chair',
    'table.addPlayer': 'Player',
    'table.swapHint': 'Drop on a player to swap, between two to slot in',
    'table.rotateHint': 'Drag the table to turn it',
    'table.start': 'Start',
    'table.needSeats': 'At least {n} seats needed',
    'table.whoSits': 'Who sits here?',
    'table.pickForSeat': 'Pick who sits here, or leave it free: whoever takes it introduces themselves when the phone comes round.',
    'table.pickProfile': 'Pick a profile or create a new one.',
    'table.allSeated': 'Every profile is already at the table: create a new one.',
    'table.playersHint': 'Tap whoever sits down: the panel stays open, so you add them one after another. The order you sort out afterwards, on the table.',
    'table.free.action': 'Clear',
    'table.remove': 'Remove',

    'packs.title': 'Words',
    'packs.section': 'Packs',
    'packs.new': '+ New pack',
    'packs.newTitle': 'New pack',
    'packs.editTitle': 'Edit pack',
    'packs.namePlaceholder': 'Pack name',
    'packs.use': 'Use {name}',
    'packs.tagCustom': ' · yours',
    'packs.tagModified': ' · edited',
    'packs.deleteSure': 'Really delete',
    'packs.deleted': 'Deleted “{name}”',
    'packs.restored': 'Put back as it was',
    'packs.saved': 'Saved “{name}” ({n} {unit})',
    'packs.added': 'Added “{name}” ({n} {unit})',
    'packs.nameRequired': 'Give the pack a name.',
    'packs.emptyText': 'The text is empty.',
    'packs.badJson': 'Invalid JSON. Check the syntax.',
    'packs.missingField': 'JSON has no valid "{field}" field.',
    'packs.notFound': 'Pack not found.',
    'packs.unit.items': 'entries',

    'mw.name': 'Mr White',
    'mw.description': 'Find the impostor who doesn’t know the word.',
    'mw.menu.play': 'Play',
    'mw.menu.playSub': 'New game',
    'mw.menu.words': 'Words',
    'mw.menu.wordsSub': 'Packs and pairs',
    'mw.menu.rules': 'How to play',
    'mw.menu.rulesSub': 'Rules and roles',
    'mw.menu.stats': 'Stats',
    'mw.menu.statsSub': 'Games and wins',

    'mw.unit.pairs': 'pairs',
    'mw.packsHelp': 'Word pairs: the civilians’ word and a similar one for the Undercovers. Tap a pack to rename it or change its pairs. Which ones to use you pick at the table, before each game.',
    'mw.packsPlaceholder': 'One pair per line:\ndog,wolf\npizza,focaccia\n\n…or JSON: { "pairs": [ { "civilian": "dog", "undercover": "wolf" } ] }',
    'mw.packsEmpty': 'No valid pair. Format: "word,similar-word" per line.',

    'mw.role.civile': 'Civilian',
    'mw.role.undercover': 'Undercover',
    'mw.role.mrwhite': 'Mr White',
    'mw.roles.civili': 'Civilians',
    'mw.roles.impostori': 'Impostors',

    'mw.rules.title': 'How to play',
    'mw.rules.rolesSection': 'Roles',
    'mw.rules.civili': 'They get the secret word.',
    'mw.rules.undercover': 'They get a similar but different word.',
    'mw.rules.mrwhite': 'Gets no word at all: must fake knowing it.',
    'mw.rules.goddess': 'Goddess of Justice',
    'mw.rules.goddessDesc': 'Drawn at random among everyone once the words are dealt. If the vote ties, she decides who goes. If she is eliminated, another one is drawn.',
    'mw.rules.countSection': 'How many impostors',
    'mw.rules.minority': 'Always outnumbered',
    'mw.rules.minorityDesc': 'Civilians must outnumber the impostors (Undercover + Mr White): with 3–4 players 1 impostor, with 5–6 up to 2, with 7–8 up to 3, and so on.',
    'mw.rules.suggested': 'Suggested',
    'mw.rules.suggestedDesc': 'About 4 impostors per 10 players: one Mr White (two from 11 up), the rest Undercover.',
    'mw.rules.flowSection': 'How a round goes',
    'mw.rules.step0': '0 · The table',
    'mw.rules.step0Desc': 'Lay the seats out as you are sitting. Whoever takes a free seat introduces themselves when the phone arrives.',
    'mw.rules.step1': '1 · Dealing',
    'mw.rules.step1Desc': 'The phone goes round the table: everyone sees their own word in private (or finds out they are Mr White).',
    'mw.rules.step2': '2 · Clues',
    'mw.rules.step2Desc': 'In turn, clockwise, everyone says out loud one word linked to their own. Don’t write it down. A Mr White never starts.',
    'mw.rules.step3': '3 · Vote',
    'mw.rules.step3Desc': 'Talk it over and eliminate a suspect by tapping them on the table. Their role is revealed. On a tie the Goddess of Justice decides.',
    'mw.rules.winSection': 'Who wins',
    'mw.rules.winCivili': 'If they eliminate every impostor (Undercover + Mr White).',
    'mw.rules.winImpostori': 'If they last until a single civilian is left.',
    'mw.rules.winMrWhite': 'If, once eliminated, they guess the civilians’ word.',

    'mw.setup.min3': 'At least 3 players are needed.',
    'mw.setup.max20': '20 players max.',
    'mw.setup.needImpostor': 'At least one impostor is needed.',
    'mw.setup.tooMany': 'Too many impostors: civilians must outnumber them.',
    'mw.setup.pickPack': 'Pick at least one word pack',
    'mw.opt.less': 'Fewer {label}',
    'mw.opt.more': 'More {label}',
    'mw.opt.civili': 'Civilians',
    'mw.opt.characters': 'Characters',
    'mw.opt.charactersHint': 'Civilians are everyone else: whoever the impostors leave over. Tap ? to see what a role does.',
    'mw.opt.words': 'Words',
    'mw.opt.choose': 'Choose',
    'mw.opt.nPacks': '{n} packs',
    'mw.opt.packsHint': 'Pick which packs the pair is drawn from. You create and edit them from “Words” in the game menu.',
    'mw.opt.nPairs': '{n} pairs',

    'mw.extra.meme': 'Mr Meme',
    'mw.extra.memeDesc': 'Every clue round one player at random gets it: they describe their word by gesture only, no talking.',
    'mw.extra.lovers': 'The Lovers',
    'mw.extra.loversDesc': 'Two players fall in love at the start, and they know it. If one is eliminated the other follows, and only then does the table find out.',
    'mw.extra.revenger': 'The Revenger',
    'mw.extra.revengerDesc': 'When eliminated, they take another player with them, their pick. Once per round.',
    'mw.extra.needPlayers': 'Needs {n} players or more.',
    'mw.extra.section': 'On top',

    'mw.deal.loverOf': 'You are in love with {name}.',
    'mw.deal.revenger': 'You are the Revenger: if they get you, you take one with you.',

    'mw.play.meme': '{name}’s turn: describe your word by gesture only, no talking.',
    'mw.play.memeNote': 'gestures',
    'mw.play.loversOut': '{a} and {b} were lovers.',

    'mw.revenge.kicker': '{name}’s revenge',
    'mw.revenge.hint': 'Tap on the table who goes with them.',
    'mw.revenge.pick': 'Pick who',
    'mw.revenge.confirm': 'Take {name}',
    'mw.revenge.note': 'revenge',

    'mw.deal.counter': 'words',
    'mw.deal.passTo': 'Pass the phone to',
    'mw.deal.onlyYou': 'Only you should see the screen.',
    'mw.deal.seeWord': 'See your word',
    'mw.deal.youAreMrWhite': 'You are Mr White',
    'mw.deal.mrWhiteHint': 'You don’t know the word: fake it.',
    'mw.deal.yourWord': 'Your word is',
    'mw.deal.hideAndStart': 'Hide and begin',
    'mw.deal.hideAndPass': 'Hide and pass on',

    'mw.join.freeSeat': 'Free seat',
    'mw.join.who': 'Who are you?',
    'mw.join.pickOrCreate': 'Before the word, introduce yourself: tap your profile or create one.',
    'mw.join.createOnly': 'Before the word, create your profile.',
    'mw.join.createMine': 'Create my profile',

    'mw.goddess.kicker': 'Goddess of Justice',
    'mw.goddess.short': 'Goddess',
    'mw.goddess.hint': 'If the vote ties, she decides who goes.',
    'mw.goddess.start': 'Let’s start',
    'mw.goddess.new': '{name} is the new Goddess of Justice.',

    'mw.play.inGame': 'in play',
    'mw.play.starts': 'starts',
    'mw.play.wasRole': '{name} was {role}',
    'mw.play.title': 'Clues',
    'mw.play.hint': '{name} starts, then clockwise: everyone says out loud one word linked to their own.',
    'mw.play.toVote': 'Go to the vote',

    'mw.vote.title': 'Vote',
    'mw.vote.hint': 'Talk it over and vote, then tap on the table who goes. On a tie {name} decides.',
    'mw.vote.clues': 'Clues',
    'mw.vote.tie': 'Tie',
    'mw.vote.noTie': 'No tie',
    'mw.vote.tieDecides': '{name} decides',
    'mw.vote.tieHint': 'The Goddess of Justice picks who goes: tap them on the table.',
    'mw.vote.goddessEliminates': '{name} eliminates',
    'mw.vote.eliminate': 'Eliminate',
    'mw.vote.guessTitle': '{name} is Mr White!',
    'mw.vote.guessBody': 'Last chance: guess the civilians’ word to win.',
    'mw.vote.guessPlaceholder': 'The civilians’ word is…',
    'mw.vote.guessWrong': 'Wrong guess',
    'mw.vote.guessConfirm': 'Confirm',

    'mw.results.civiliWin': 'The Civilians win',
    'mw.results.civiliWinSub': 'Every impostor has been unmasked.',
    'mw.results.mrWhiteWin': 'Mr White wins',
    'mw.results.mrWhiteWinSub': '{name} guessed the word.',
    'mw.results.impostoriWin': 'The Impostors win',
    'mw.results.impostoriWinSub': 'They survived to the end.',
    'mw.results.replay': 'Play again',
    'mw.results.changeTable': 'Change table',
    'mw.results.recCivili': 'Civilians win',
    'mw.results.recMrWhite': 'Mr White guessed',
    'mw.results.recImpostori': 'Impostors win',

    'mw.leave.title': 'Leave the game?',
    'mw.leave.body': 'The round in progress will be lost.',
    'mw.leave.stay': 'Stay',
    'mw.leave.exit': 'Leave',

    'hu.name': 'Heads Up',
    'hu.description': 'Phone on your forehead: guess the word from the clues.',
    'hu.menu.play': 'Play',
    'hu.menu.playSub': 'New game',
    'hu.menu.words': 'Words',
    'hu.menu.wordsSub': 'Categories',
    'hu.menu.rules': 'How to play',
    'hu.menu.rulesSub': 'Rules',

    'hu.unit.words': 'words',
    'hu.packsHelp': 'Words and names to guess. Switch on the categories you want to play; you can add your own.',
    'hu.packsPlaceholder': 'One word per line:\nSpiderman\nPizza\nDancing the macarena\n\n…or JSON: { "words": ["Spiderman", "Pizza"] }',
    'hu.packsEmpty': 'No valid word. Write one word per line.',

    'hu.rules.title': 'How to play',
    'hu.rules.shortSection': 'In short',
    'hu.rules.phone': 'Phone on the forehead',
    'hu.rules.phoneDesc': 'One player holds the phone on their forehead, screen facing the others.',
    'hu.rules.clues': 'The others give clues',
    'hu.rules.cluesDesc': 'They describe the word without saying it, until you guess it.',
    'hu.rules.tilt': 'Tilt',
    'hu.rules.tiltDesc': 'Down = guessed, up = pass. Or tap the screen (right = correct, left = pass).',
    'hu.rules.goalSection': 'Goal',
    'hu.rules.goal': 'As many words as you can',
    'hu.rules.goalDesc': 'Guess as many as possible before time runs out.',

    'hu.setup.category': 'Category',
    'hu.setup.noCategory': 'No category is active. Add one or switch one on in “Manage words”.',
    'hu.setup.manage': 'Manage words',
    'hu.setup.duration': 'Duration',
    'hu.setup.controls': 'Controls',
    'hu.setup.tiltHint': 'Tilt the phone down = correct, up = pass. Or tap the screen: right = correct, left = pass.',
    'hu.setup.noSensor': 'No sensor available: tap the screen — right = correct, left = pass.',
    'hu.setup.invert': 'Invert tilt',
    'hu.setup.continue': 'Continue',

    'hu.ready.title': 'Ready?',
    'hu.ready.step1': 'Turn the phone to landscape.',
    'hu.ready.step2': 'Hold it on your forehead, screen facing the others.',
    'hu.ready.step3': 'The others give you clues. Guess the word!',
    'hu.ready.step4': 'Down = correct · Up = pass (or tap right/left).',
    'hu.ready.start': 'Go',
    'hu.countdown.go': 'Go!',

    'hu.play.hint': '← pass · correct →',
    'hu.play.noSensorHint': 'No sensor — tap: ← pass · correct →',
    'hu.play.tapHint': 'Tap: ← pass · correct →',

    'hu.results.title': 'Result',
    'hu.results.guessed': '{n} guessed',
    'hu.results.passedLine': '{n} passed · {s}s',
    'hu.results.guessedSection': 'Guessed ✅',
    'hu.results.passedSection': 'Passed ⏭️',
    'hu.results.empty': 'No word played.',
    'hu.results.replay': 'Play again',
    'hu.results.changeCategory': 'Change category',
    'hu.results.home': 'Back home'
  }
}

function normalize(value) {
  const l = String(value || '').slice(0, 2).toLowerCase()
  return LANGS.includes(l) ? l : null
}

// Your choice if you made one, otherwise English — whoever opens GameHub
// without touching anything gets the language most people at a party can read.
// The phone's own language is deliberately NOT consulted: an Italian phone
// would land on Italian, which is the opposite of a default.
let lang = normalize(storage.get(KEY, null)) || 'en'

const listeners = new Set()

export function getLang() { return lang }
export function getLocale() { return LOCALES[lang] || 'it-IT' }
export function langName(l = lang) { return LANG_NAMES[l] || l }

export function setLang(next) {
  const l = normalize(next)
  if (!l || l === lang) return lang
  lang = l
  storage.set(KEY, lang)
  if (typeof document !== 'undefined') document.documentElement.lang = lang
  for (const fn of listeners) fn(lang)
  return lang
}

// The settings bead: one tap moves to the next language, then wraps.
export function cycleLang() {
  return setLang(LANGS[(LANGS.indexOf(lang) + 1) % LANGS.length])
}

export function onLangChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function t(key, vars) {
  const table = DICT[lang] || DICT.it
  let s = table[key]
  if (s == null) s = DICT.it[key]
  if (s == null) return key
  if (!vars) return s
  return s.replace(/\{(\w+)\}/g, (m, name) => (vars[name] == null ? m : String(vars[name])))
}

if (typeof document !== 'undefined') document.documentElement.lang = lang
