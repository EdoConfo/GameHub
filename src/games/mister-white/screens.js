// Mister White — the plain pages reached from the game's menu. The match
// itself is played around the table (see match.js).
import { el, screen } from '../../shared/ui.js'
import { t } from '../../shared/i18n.js'
import { avatar } from '../../hub/players.js'

// ---------- RULES ----------
export function renderRules(api) {
  const view = screen({ title: t('mw.rules.title'), onBack: () => api.toMenu() })
  // `title` here, not `t`: `t` is the translator.
  const rule = (title, desc) => el('div', { class: 'rule' }, [el('div', { class: 'rule-title' }, title), el('div', { class: 'rule-desc muted' }, desc)])
  view.body.append(section(t('mw.rules.rolesSection'), [
    rule(t('mw.roles.civili'), t('mw.rules.civili')),
    rule(t('mw.role.undercover'), t('mw.rules.undercover')),
    rule(t('mw.role.mrwhite'), t('mw.rules.mrwhite')),
    rule(t('mw.rules.goddess'), t('mw.rules.goddessDesc'))
  ]))
  view.body.append(section(t('mw.rules.countSection'), [
    rule(t('mw.rules.minority'), t('mw.rules.minorityDesc')),
    rule(t('mw.rules.suggested'), t('mw.rules.suggestedDesc'))
  ]))
  view.body.append(section(t('mw.rules.flowSection'), [
    rule(t('mw.rules.step0'), t('mw.rules.step0Desc')),
    rule(t('mw.rules.step1'), t('mw.rules.step1Desc')),
    rule(t('mw.rules.step2'), t('mw.rules.step2Desc')),
    rule(t('mw.rules.step3'), t('mw.rules.step3Desc'))
  ]))
  view.body.append(section(t('mw.rules.winSection'), [
    rule(t('mw.roles.civili'), t('mw.rules.winCivili')),
    rule(t('mw.roles.impostori'), t('mw.rules.winImpostori')),
    rule(t('mw.role.mrwhite'), t('mw.rules.winMrWhite'))
  ]))
  return view
}

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
