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

  const list = el('div', { class: 'game-list' })
  for (const game of games) {
    list.append(
      el('button', {
        class: 'game-card',
        onclick: () => ctx.router.go('/game/' + game.id)
      }, [
        el('span', { class: 'game-card-icon' }, game.icon || '🎲'),
        el('span', { class: 'game-card-text' }, [
          el('span', { class: 'game-card-name' }, game.name),
          el('span', { class: 'game-card-desc' }, game.description || '')
        ]),
        el('span', { class: 'game-card-arrow', 'aria-hidden': 'true' }, '›')
      ])
    )
  }
  view.body.append(list)

  view.body.append(
    el('div', { class: 'offline-note' }, [
      el('strong', {}, '📴 Funziona offline. '),
      'Dopo la prima apertura puoi usarla senza rete. ',
      'Dal browser del telefono scegli “Aggiungi alla schermata Home” per installarla come app.'
    ])
  )

  root.append(view)
}
