import { el, screen, button, modal, clear } from '../shared/ui.js'
import { t, getLocale } from '../shared/i18n.js'
import { avatar, openProfileEditor } from './players.js'
import { games, getGame } from '../games/registry.js'

const gameIds = games.map(g => g.id)

const PENCIL_SVG = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f2a83b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="M13 7l3 3"/></svg>'
const TRASH_SVG = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff5d73" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7"/><path d="M6.5 7l.9 12a2 2 0 0 0 2 1.9h5.2a2 2 0 0 0 2-1.9L17.5 7"/><path d="M10 11v6M14 11v6"/></svg>'

export function renderPlayer(root, ctx, id) {
  function draw() {
    clear(root)
    const p = ctx.players.get(id)
    if (!p) { ctx.router.go('/players'); return }

    const view = screen({
      title: '',
      onBack: () => ctx.router.go('/players'),
      actions: [
        el('button', { class: 'icon-btn', 'aria-label': t('common.edit'), html: PENCIL_SVG, onclick: () => openProfileEditor(ctx, p, draw) }),
        el('button', { class: 'icon-btn', 'aria-label': t('common.delete'), html: TRASH_SVG, onclick: () => confirmDelete(p) })
      ]
    })

    // Hero
    view.body.append(el('div', { class: 'player-hero' }, [
      avatar(p, 96),
      el('h1', { class: 'player-hero-name' }, p.name)
    ]))

    // Stats summary
    const { total, perGame } = ctx.stats.summary(gameIds, id)
    const winPct = total.played ? Math.round((total.won / total.played) * 100) : 0
    view.body.append(el('div', { class: 'stat-cards' }, [
      statCard(total.played, t('stats.played')),
      statCard(total.won, t('stats.won')),
      statCard(winPct + '%', t('stats.winRate'))
    ]))

    // Per-game breakdown
    const perRows = Object.entries(perGame)
    if (perRows.length) {
      const box = el('div', { class: 'card-section' }, [el('h2', { class: 'section-title' }, t('player.perGame'))])
      for (const [gid, s] of perRows) {
        const g = getGame(gid)
        box.append(el('div', { class: 'pergame-row' }, [
          el('span', { class: 'pergame-icon' }, g?.icon || '🎲'),
          el('span', { class: 'pergame-name' }, g?.name || gid),
          el('span', { class: 'muted small' }, `${s.won}/${s.played}`)
        ]))
      }
      view.body.append(box)
    }

    // Feed
    const feed = ctx.stats.feed(gameIds, id, 30)
    const feedBox = el('div', { class: 'card-section' }, [el('h2', { class: 'section-title' }, t('player.recent'))])
    if (!feed.length) {
      feedBox.append(el('p', { class: 'muted' }, t('player.emptyFeed')))
    } else {
      for (const item of feed) {
        const g = getGame(item.gameId)
        feedBox.append(el('div', { class: 'feed-row' }, [
          el('span', { class: 'feed-icon' }, g?.icon || '🎲'),
          el('span', { class: 'feed-main' }, [
            el('span', { class: 'feed-title' }, g?.name || item.gameId),
            el('span', { class: 'feed-sub muted small' }, item.result || '')
          ]),
          el('span', { class: 'feed-badge ' + (item.won ? 'win' : 'lose') }, item.won ? t('player.win') : t('player.loss')),
          el('span', { class: 'feed-time muted small' }, relTime(item.ts))
        ]))
      }
    }
    view.body.append(feedBox)

    root.append(view)
  }

  function confirmDelete(p) {
    const m = modal({
      title: t('player.deleteTitle', { name: p.name }),
      content: [el('p', { class: 'muted' }, t('player.deleteBody'))],
      actions: [
        button(t('common.cancel'), { variant: 'ghost', onClick: () => m.close() }),
        button(t('common.delete'), { variant: 'danger', onClick: () => { ctx.players.remove(p.id); m.close(); ctx.router.go('/players') } })
      ]
    })
  }

  draw()
}

function statCard(value, label) {
  return el('div', { class: 'stat-card' }, [
    el('div', { class: 'stat-value' }, String(value)),
    el('div', { class: 'stat-label' }, label)
  ])
}

function relTime(ts) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return t('time.now')
  const m = Math.floor(s / 60)
  if (m < 60) return t('time.min', { n: m })
  const h = Math.floor(m / 60)
  if (h < 24) return t('time.hour', { n: h })
  const d = Math.floor(h / 24)
  if (d < 7) return t('time.day', { n: d })
  return new Date(ts).toLocaleDateString(getLocale(), { day: 'numeric', month: 'short' })
}
