// Mister White — the plain pages reached from the game's menu. The match
// itself is played around the table (see match.js).
import { el, screen } from '../../shared/ui.js'
import { renderPackManager } from '../../shared/packManagerScreen.js'
import { avatar } from '../../hub/players.js'

// ---------- PACKS (manage words for this game) ----------
export function renderPacks(api) {
  return renderPackManager(api.packs, {
    title: 'Parole',
    help: 'Coppie di parole (una segreta, una simile). Attiva i pacchetti da usare; puoi aggiungerne di tuoi.',
    onBack: () => api.toMenu()
  })
}

// ---------- RULES ----------
export function renderRules(api) {
  const view = screen({ title: 'Come si gioca', onBack: () => api.toMenu() })
  const rule = (t, d) => el('div', { class: 'rule' }, [el('div', { class: 'rule-title' }, t), el('div', { class: 'rule-desc muted' }, d)])
  view.body.append(section('Ruoli', [
    rule('Civili', 'Ricevono la parola segreta.'),
    rule('Undercover', 'Ricevono una parola simile ma diversa.'),
    rule('Mister White', 'Non riceve nessuna parola: deve fingere di saperla.')
  ]))
  view.body.append(section('Come si svolge', [
    rule('0 · Il tavolo', 'Disponete i posti come siete seduti. Chi trova un posto libero si presenta quando riceve il telefono.'),
    rule('1 · Distribuzione', 'Il telefono fa il giro del tavolo: ognuno vede in privato la sua parola (o scopre di essere Mister White).'),
    rule('2 · Indizi', 'A turno, in senso orario, ognuno dice a voce una parola collegata alla propria. Non scriverla.'),
    rule('3 · Votazione', 'Discutete ed eliminate un sospetto toccandolo sul tavolo. Si scopre il suo ruolo.')
  ]))
  view.body.append(section('Chi vince', [
    rule('Civili', 'Se eliminano tutti gli impostori (Undercover + Mister White).'),
    rule('Impostori', 'Se sopravvivono fino a pareggiare i civili.'),
    rule('Mister White', 'Se, una volta eliminato, indovina la parola dei civili.')
  ]))
  return view
}

// ---------- STATS ----------
export function renderStats(api) {
  const { ctx } = api
  const view = screen({ title: 'Statistiche', onBack: () => api.toMenu() })
  const data = ctx.stats.get('mister-white')
  const rows = Object.entries(data)
    .map(([id, s]) => ({ p: ctx.players.get(id), ...s }))
    .filter(r => r.p)
    .sort((a, b) => b.won - a.won || b.played - a.played)

  if (!rows.length) {
    view.body.append(el('p', { class: 'muted center' }, 'Ancora nessuna partita registrata. Gioca per vedere le statistiche!'))
    return view
  }

  const table = el('div', { class: 'stats-table' })
  table.append(el('div', { class: 'stats-head' }, [
    el('span', {}, 'Giocatore'), el('span', {}, 'Giocate'), el('span', {}, 'Vinte'), el('span', {}, '%')
  ]))
  for (const r of rows) {
    const pct = r.played ? Math.round((r.won / r.played) * 100) : 0
    table.append(el('div', { class: 'stats-row' }, [
      el('span', { class: 'stats-player' }, [avatar(r.p, 26), el('span', {}, r.p.name)]),
      el('span', {}, String(r.played)),
      el('span', {}, String(r.won)),
      el('span', {}, pct + '%')
    ]))
  }
  view.body.append(table)
  return view
}

// ---------- helpers ----------
function section(title, children = []) {
  return el('section', { class: 'card-section' }, [el('h2', { class: 'section-title' }, title), ...children])
}
