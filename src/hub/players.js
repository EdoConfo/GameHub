import { el, screen, button, modal, clear } from '../shared/ui.js'
import { COLORS, EMOJIS } from '../shared/players.js'

const USER_SVG = size =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="#fff" aria-hidden="true"><path d="M12 12.6a4.3 4.3 0 1 0 0-8.6 4.3 4.3 0 0 0 0 8.6Zm0 1.6c-3.9 0-7 2.3-7 5.2v.9h14v-.9c0-2.9-3.1-5.2-7-5.2Z"/></svg>`

// A circular avatar: photo > emoji > generic user icon, on the profile color.
export function avatar(p, size = 32) {
  const base = `width:${size}px;height:${size}px`
  if (p && p.photo) {
    return el('span', { class: 'avatar avatar-photo', style: `${base};background-image:url(${p.photo})` })
  }
  const bg = (p && p.color) || '#888'
  if (p && p.emoji) {
    return el('span', { class: 'avatar', style: `${base};background:${bg};font-size:${Math.round(size * 0.52)}px` }, p.emoji)
  }
  return el('span', { class: 'avatar', style: `${base};background:${bg}`, html: USER_SVG(Math.round(size * 0.64)) })
}

// Players portal — the shared "accounts" manager, opened from the hub header.
export function renderPlayers(root, ctx) {
  const view = screen({
    title: 'Giocatori',
    onBack: () => ctx.router.go('/'),
    actions: [el('button', { class: 'icon-btn', 'aria-label': 'Nuovo giocatore', onclick: () => openProfileEditor(ctx, null, () => refresh()) }, '+')]
  })
  const list = el('div', { class: 'profile-list' })

  function refresh() {
    clear(list)
    const players = ctx.players.all()
    if (!players.length) {
      list.append(el('p', { class: 'muted center' }, 'Nessun giocatore. Tocca + in alto per aggiungerne uno: sarà disponibile in tutti i giochi.'))
    }
    for (const p of players) {
      list.append(el('button', {
        class: 'profile-row',
        onclick: () => ctx.router.go('/player/' + p.id)
      }, [
        avatar(p, 40),
        el('span', { class: 'profile-name' }, p.name),
        el('span', { class: 'profile-arrow', 'aria-hidden': 'true' }, '›')
      ]))
    }
  }

  view.body.append(list)
  refresh()
  root.append(view)
}

// Downscale + center-square-crop an image File to a JPEG data URL.
function fileToAvatar(file, max = 320, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const iw = img.naturalWidth, ih = img.naturalHeight
      const s = Math.min(iw, ih)
      const out = Math.min(max, s)
      const canvas = document.createElement('canvas')
      canvas.width = out; canvas.height = out
      const g = canvas.getContext('2d')
      g.drawImage(img, (iw - s) / 2, (ih - s) / 2, s, s, 0, 0, out, out)
      URL.revokeObjectURL(url)
      try { resolve(canvas.toDataURL('image/jpeg', quality)) } catch (e) { reject(e) }
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Immagine non valida')) }
    img.src = url
  })
}

// No `capture` attr -> on mobile the OS lets the user pick Camera or Library.
function pickPhoto(onData) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = () => {
    const f = input.files && input.files[0]
    if (f) fileToAvatar(f).then(onData).catch(() => {})
  }
  input.click()
}

// Add/edit modal, reusable from the portal and the player page.
export function openProfileEditor(ctx, existing, onDone) {
  const suggested = existing || ctx.players.suggest()
  const state = {
    name: existing?.name || '',
    color: existing?.color || suggested.color,
    emoji: existing?.emoji || null, // default: no emoji (generic icon)
    photo: existing?.photo || null
  }

  // Big avatar + "Carica foto" directly under it.
  const bigAvatar = el('div', { class: 'edit-avatar' })
  const photoBtn = button('Carica foto', { variant: 'secondary', onClick: () => pickPhoto(data => { state.photo = data; rebuild() }) })
  const removeLink = el('button', { class: 'link-btn edit-remove', onclick: () => { state.photo = null; rebuild() } }, 'Rimuovi foto')
  const head = el('div', { class: 'edit-head' }, [bigAvatar, photoBtn, removeLink])

  const nameInput = el('input', { class: 'text-input', type: 'text', placeholder: 'Nome', maxlength: '20', value: state.name })

  const colorRow = el('div', { class: 'swatch-row' })
  for (const c of COLORS) colorRow.append(el('button', { class: 'swatch', style: `background:${c}`, onclick: () => { state.color = c; rebuild() } }))

  const emojiRow = el('div', { class: 'emoji-grid' })
  for (const e of EMOJIS) {
    emojiRow.append(el('button', {
      class: 'emoji-cell',
      // toggle: pick emoji (clears photo); tapping the active one clears it -> generic icon
      onclick: () => { state.emoji = state.emoji === e ? null : e; if (state.emoji) state.photo = null; rebuild() }
    }, e))
  }
  const emojiBlock = el('div', { class: 'stack-gap' }, [
    el('div', { class: 'field-label' }, 'Colore'), colorRow,
    el('div', { class: 'field-label' }, 'Emoji (opzionale)'), emojiRow
  ])

  function rebuild() {
    clear(bigAvatar); bigAvatar.append(avatar(state, 96))
    removeLink.style.display = state.photo ? '' : 'none'
    colorRow.querySelectorAll('.swatch').forEach((b, i) => b.classList.toggle('on', COLORS[i] === state.color))
    emojiRow.querySelectorAll('.emoji-cell').forEach((b, i) => b.classList.toggle('on', !state.photo && EMOJIS[i] === state.emoji))
  }

  const err = el('p', { class: 'error-text' })
  const m = modal({
    title: existing ? 'Modifica giocatore' : 'Nuovo giocatore',
    content: [head, nameInput, emojiBlock, err],
    actions: [
      button('Annulla', { variant: 'ghost', onClick: () => m.close() }),
      button('Salva', {
        variant: 'primary', onClick: () => {
          const name = nameInput.value.trim()
          if (!name) { err.textContent = 'Serve un nome.'; return }
          const patch = { name, color: state.color, emoji: state.emoji, photo: state.photo }
          if (existing) ctx.players.update(existing.id, patch)
          else ctx.players.add(patch)
          m.close()
          onDone && onDone()
        }
      })
    ]
  })
  rebuild()
  nameInput.focus()
}
