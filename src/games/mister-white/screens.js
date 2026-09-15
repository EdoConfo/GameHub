// Mister White — the plain pages reached from the game's menu. The match
// itself is played around the table (see match.js).
import { el, screen } from '../../shared/ui.js'
import { t } from '../../shared/i18n.js'
import { avatar } from '../../hub/players.js'

// ---------- STATS ----------
export function renderStats(api) {
  const { ctx } = api
  const view = screen({ title: t('stats.title'), onBack: () => api.toMenu() })
  const data = ctx.stats.get('mister-white')
  const rows = Object.entries(data)
    .map(([id, s]) => ({ p: ctx.players.get(id), ...s }))
    .filter(r => r.p)
    .sort((a, b) => b.won - a.won || b.played - a.played)

  if (!rows.length) {
    view.body.append(el('p', { class: 'muted center' }, t('stats.empty')))
    return view
  }

  const table = el('div', { class: 'stats-table' })
  table.append(el('div', { class: 'stats-head' }, [
    el('span', {}, t('stats.player')), el('span', {}, t('stats.playedShort')), el('span', {}, t('stats.wonShort')), el('span', {}, '%')
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
