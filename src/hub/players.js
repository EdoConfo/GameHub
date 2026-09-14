import { el, button, modal, clear } from '../shared/ui.js'
import { t } from '../shared/i18n.js'
import { COLORS, EMOJIS } from '../shared/players.js'

// Generic user icon: always the same neutral grey, visible on any colour
// (including white and black backgrounds).
const USER_INK = '#9aa0aa'
const USER_SVG = size =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${USER_INK}" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8.4" r="3.3"/><path d="M5.6 19.4a6.4 6.4 0 0 1 12.8 0"/></svg>`

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

// An empty chair at the table: dashed outline, same generic user icon.
export function emptyAvatar(size = 32) {
  return el('span', { class: 'avatar avatar-empty', style: `width:${size}px;height:${size}px`, html: USER_SVG(Math.round(size * 0.5)) })
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
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(t('players.badImage'))) }
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

// Add/edit modal, reusable from the portal, the player page and the table.
// onDone(profile) gets the saved profile.
export function openProfileEditor(ctx, existing, onDone, { title } = {}) {
  const suggested = existing || ctx.players.suggest()
  const state = {
    name: existing?.name || '',
    color: existing?.color || suggested.color,
    emoji: existing?.emoji || null, // default: no emoji (generic icon)
    photo: existing?.photo || null
  }

  // Big avatar + "Carica foto" directly under it.
  const bigAvatar = el('div', { class: 'edit-avatar' })
  const photoBtn = button(t('players.loadPhoto'), { variant: 'secondary', onClick: () => pickPhoto(data => { state.photo = data; rebuild() }) })
  const removeLink = el('button', { class: 'link-btn edit-remove', onclick: () => { state.photo = null; rebuild() } }, t('players.removePhoto'))
  const head = el('div', { class: 'edit-head' }, [bigAvatar, photoBtn, removeLink])

  const nameInput = el('input', { class: 'text-input', type: 'text', placeholder: t('players.namePlaceholder'), maxlength: '20', value: state.name })

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
    el('div', { class: 'field-label' }, t('players.color')), colorRow,
    el('div', { class: 'field-label' }, t('players.emojiOptional')), emojiRow
  ])

  function rebuild() {
    clear(bigAvatar); bigAvatar.append(avatar(state, 96))
    removeLink.style.display = state.photo ? '' : 'none'
    colorRow.querySelectorAll('.swatch').forEach((b, i) => b.classList.toggle('on', COLORS[i] === state.color))
    emojiRow.querySelectorAll('.emoji-cell').forEach((b, i) => b.classList.toggle('on', !state.photo && EMOJIS[i] === state.emoji))
  }

  const err = el('p', { class: 'error-text' })
  const m = modal({
    title: title || (existing ? t('players.editTitle') : t('players.newTitle')),
    content: [head, nameInput, emojiBlock, err],
    actions: [
      button(t('common.cancel'), { variant: 'ghost', onClick: () => m.close() }),
      button(t('common.save'), {
        variant: 'primary', onClick: () => {
          const name = nameInput.value.trim()
          if (!name) { err.textContent = t('players.nameRequired'); return }
          const patch = { name, color: state.color, emoji: state.emoji, photo: state.photo }
          const saved = existing ? ctx.players.update(existing.id, patch) : ctx.players.add(patch)
          m.close()
          onDone && onDone(saved)
        }
      })
    ]
  })
  rebuild()
  nameInput.focus()
}
