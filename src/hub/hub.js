import { el, screen } from '../shared/ui.js'
import { games } from '../games/registry.js'

export function renderHub(root, ctx) {
  const view = screen({
    actions: [
      el('button', {
        class: 'icon-btn',
        'aria-label': 'Impostazioni',
        onclick: () => ctx.router.go('/settings')
      }, '⚙')
    ]
  })

  view.body.append(
    el('div', { class: 'hub-hero' }, [
      el('h1', { class: 'hub-title' }, 'GameHub'),
      el('p', { class: 'hub-subtitle' }, 'Giochi da fare tutti insieme, un telefono solo.')
    ])
  )

  const grid = el('div', { class: 'game-grid' })
  for (const game of games) {
    grid.append(
      el('button', {
        class: 'game-card',
        onclick: () => ctx.router.go('/game/' + game.id)
      }, [
        el('span', { class: 'game-card-icon' }, game.icon || '🎲'),
        el('span', { class: 'game-card-name' }, game.name),
        el('span', { class: 'game-card-desc' }, game.description || '')
      ])
    )
  }
  view.body.append(grid)

  view.body.append(
    el('div', { class: 'offline-note' }, [
      el('strong', {}, '📴 Funziona offline. '),
      'Dopo la prima apertura puoi usarla senza rete. ',
      'Dal browser del telefono scegli “Aggiungi alla schermata Home” per installarla come app.'
    ])
  )

  root.append(view)
}
