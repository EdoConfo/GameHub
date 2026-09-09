import { el, screen, button, modal, clear, toast } from '../shared/ui.js'
import { COLORS, EMOJIS } from '../shared/players.js'

// Players portal — the shared "accounts" manager, opened from the hub header.
export function renderPlayers(root, ctx) {
  const view = screen({ title: 'Giocatori', onBack: () => ctx.router.go('/') })
  const list = el('div', { class: 'profile-list' })

  function refresh() {
    clear(list)
    const players = ctx.players.all()
    if (!players.length) {
      list.append(el('p', { class: 'muted center' }, 'Nessun giocatore. Aggiungine uno: sarà disponibile in tutti i giochi.'))
    }
    for (const p of players) {
      list.append(el('div', { class: 'profile-row' }, [
        avatar(p),
        el('span', { class: 'profile-name' }, p.name),
        el('div', { class: 'profile-actions' }, [
          el('button', { class: 'chip-x', 'aria-label': 'Modifica', onclick: () => openEdit(p) }, '✎'),
          el('button', { class: 'chip-x', 'aria-label': 'Elimina', onclick: () => { ctx.players.remove(p.id); refresh() } }, '×')
        ])
      ]))
    }
  }

  view.body.append(list)
  view.body.append(button('+ Nuovo giocatore', { variant: 'primary', full: true, onClick: () => openEdit(null) }))
  refresh()
  root.append(view)

  function openEdit(existing) {
    const s = existing || ctx.players.suggest()
    const state = { name: existing?.name || '', color: existing?.color || s.color, emoji: existing?.emoji || s.emoji }

    const nameInput = el('input', { class: 'text-input', type: 'text', placeholder: 'Nome', maxlength: '20', value: state.name })

    const colorRow = el('div', { class: 'swatch-row' })
    const emojiRow = el('div', { class: 'emoji-grid' })
    for (const c of COLORS) {
      colorRow.append(el('button', {
        class: 'swatch' + (state.color === c ? ' on' : ''),
        style: `background:${c}`,
        onclick: () => { state.color = c; rebuild() }
      }))
    }
    for (const e of EMOJIS) {
      emojiRow.append(el('button', {
        class: 'emoji-cell' + (state.emoji === e ? ' on' : ''),
        onclick: () => { state.emoji = e; rebuild() }
      }, e))
    }

    const head = el('div', { class: 'profile-edit-head' })
    function rebuild() {
      clear(head); head.append(avatar(state))
      colorRow.querySelectorAll('.swatch').forEach((b, i) => b.classList.toggle('on', COLORS[i] === state.color))
      emojiRow.querySelectorAll('.emoji-cell').forEach((b, i) => b.classList.toggle('on', EMOJIS[i] === state.emoji))
    }

    const err = el('p', { class: 'error-text' })
    const m = modal({
      title: existing ? 'Modifica giocatore' : 'Nuovo giocatore',
      content: [head, nameInput, el('div', { class: 'field-label' }, 'Colore'), colorRow, el('div', { class: 'field-label' }, 'Avatar'), emojiRow, err],
      actions: [
        button('Annulla', { variant: 'ghost', onClick: () => m.close() }),
        button('Salva', {
          variant: 'primary', onClick: () => {
            const name = nameInput.value.trim()
            if (!name) { err.textContent = 'Serve un nome.'; return }
            if (existing) ctx.players.update(existing.id, { name, color: state.color, emoji: state.emoji })
            else ctx.players.add({ name, color: state.color, emoji: state.emoji })
            m.close(); refresh()
          }
        })
      ]
    })
    rebuild()
    nameInput.focus()
  }
}

// A colored circular avatar with the profile emoji.
export function avatar(p, size) {
  const node = el('span', { class: 'avatar', style: `background:${p.color}${size ? `;width:${size}px;height:${size}px;font-size:${Math.round(size * 0.52)}px` : ''}` }, p.emoji || '🙂')
  return node
}
