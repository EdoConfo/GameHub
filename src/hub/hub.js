import { el, icon } from '../shared/ui.js'
import { createArcWheel } from '../shared/arcWheel.js'
import { games } from '../games/registry.js'

// Hub = arc wheel of games on the LEFT. Picking a game slides the hub out to
// the left; the game's own mirrored menu wheel enters from the right.
export function renderHub(root, ctx) {
  const hub = el('div', { class: 'hub' })

  hub.append(el('div', { class: 'hub-header' }, [
    el('span', { class: 'wordmark' }, 'GAMEHUB'),
    el('div', { class: 'hub-header-actions' }, [
      el('button', { class: 'icon-btn', 'aria-label': 'Giocatori', onclick: () => ctx.router.go('/players') }, icon('players')),
      el('button', { class: 'icon-btn', 'aria-label': 'Impostazioni', onclick: () => ctx.router.go('/settings') }, icon('settings'))
    ])
  ]))

  const host = el('div', { class: 'arc-host' })
  hub.append(host)
  hub.append(el('div', { class: 'hub-hint' }, 'scorri per scegliere · tocca per giocare'))
  hub.append(el('div', { class: 'offline-note' }, [
    el('strong', {}, '📴 Funziona offline. '),
    'Aggiungila alla schermata Home per usarla come app.'
  ]))
  root.append(hub)

  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  function open(i) {
    if (reduce) { ctx.router.go('/game/' + games[i].id); return }
    hub.classList.add('exit-left')
    setTimeout(() => ctx.router.go('/game/' + games[i].id), 300)
  }

  createArcWheel(host, {
    side: 'left',
    items: games.map(g => ({ title: g.name, sub: g.description })),
    onActivate: open
  })
}
