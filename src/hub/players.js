import { el, screen, button, modal, clear } from '../shared/ui.js'
import { COLORS, EMOJIS } from '../shared/players.js'

// A circular avatar: photo if the profile has one, else colored emoji.
export function avatar(p, size = 32) {
  const base = `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.52)}px`
  if (p && p.photo) {
    return el('span', { class: 'avatar avatar-photo', style: `${base};background-image:url(${p.photo})` })
  }
  return el('span', { class: 'avatar', style: `${base};background:${(p && p.color) || '#888'}` }, (p && p.emoji) || '🙂')
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

function pickPhoto(onData) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.setAttribute('capture', 'environment') // hints the camera on mobile
  input.onchange = () => {
    const f = input.files && input.files[0]
    if (f) fileToAvatar(f).then(onData).catch(() => {})
  }
  input.click()
}

// Add/edit modal, reusable from the portal and the player page.
export function openProfileEditor(ctx, existing, onDone) {
  const s = existing || ctx.players.suggest()
  const state = {
    name: existing?.name || '',
    color: existing?.color || s.color,
    emoji: existing?.emoji || s.emoji,
    photo: existing?.photo || null
  }

  const head = el('div', { class: 'profile-edit-head' })
  const nameInput = el('input', { class: 'text-input', type: 'text', placeholder: 'Nome', maxlength: '20', value: state.name })

  const photoBtn = button('📷 Foto', { variant: 'secondary', onClick: () => pickPhoto(data => { state.photo = data; rebuild() }) })
  const removePhotoBtn = button('Rimuovi foto', { variant: 'ghost', onClick: () => { state.photo = null; rebuild() } })
  const photoRow = el('div', { class: 'row' }, [photoBtn, removePhotoBtn])

  const colorRow = el('div', { class: 'swatch-row' })
  const emojiRow = el('div', { class: 'emoji-grid' })
  for (const c of COLORS) colorRow.append(el('button', { class: 'swatch', style: `background:${c}`, onclick: () => { state.color = c; rebuild() } }))
  for (const e of EMOJIS) emojiRow.append(el('button', { class: 'emoji-cell', onclick: () => { state.emoji = e; state.photo = null; rebuild() } }, e))

  const emojiBlock = el('div', { class: 'stack-gap' }, [
    el('div', { class: 'field-label' }, 'Colore'), colorRow,
    el('div', { class: 'field-label' }, 'Avatar'), emojiRow
  ])

  function rebuild() {
    clear(head); head.append(avatar(state, 64))
    removePhotoBtn.style.display = state.photo ? '' : 'none'
    emojiBlock.style.opacity = state.photo ? '.4' : '1'
    colorRow.querySelectorAll('.swatch').forEach((b, i) => b.classList.toggle('on', COLORS[i] === state.color))
    emojiRow.querySelectorAll('.emoji-cell').forEach((b, i) => b.classList.toggle('on', !state.photo && EMOJIS[i] === state.emoji))
  }

  const err = el('p', { class: 'error-text' })
  const m = modal({
    title: existing ? 'Modifica giocatore' : 'Nuovo giocatore',
    content: [head, nameInput, photoRow, emojiBlock, err],
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
