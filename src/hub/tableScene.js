import { el, icon, button, walls } from '../shared/ui.js'
import { t } from '../shared/i18n.js'
import { createTableStage } from '../shared/tableStage.js'
import { avatar, faceGrid, newFaceCell, openProfileEditor } from './players.js'

// How long the game's circle takes to become the table, coming out of the
// menu. Exported for whoever rides along with it.
export const TABLE_MORPH_MS = 780

// Mark a node as the page's scrolling part (see .list-scroll).
const scrollable = node => { node.classList.add('list-scroll'); return walls(node) }

const pill = (glyph, label, onClick) =>
  el('button', { class: 'pill', onclick: onClick }, [icon(glyph), el('span', {}, label)])

// "Gioca": the game's circle shrinks to the top of the screen and becomes the
// table — who sits where, in the order the phone goes round. A drawer rises
// from below with the table controls and this game's options.
//   from: circle B on screen, to morph out of (omit: pick up where it last was)
export function openTableScene(canvas, header, ctx, game, { from } = {}) {
  const cfg = game.table
  // the game's knobs: { node, check(n) -> '' | message }. They can open a page
  // of their own in the drawer (e.g. choosing word packs); "Fatto" comes back.
  const options = cfg.options(ctx, {
    changed: () => refresh(),
    // a page of the game's own: it rises OVER this drawer and covers it, and
    // leaves either way you close it — "Fatto" or the handle pulled down
    open: (title, content) => stage.openSheet(el('div', { class: 'drawer-page' }, [
      el('div', { class: 'drawer-title' }, title),
      ...content,
      button(t('common.done'), { variant: 'ghost', full: true, onClick: () => stage.closeSheet() })
    ]), { done: () => refresh() })
  })
  let picking = null // seat index whose chair we're filling, or 'new'

  const stage = createTableStage(canvas, {
    top: () => header.offsetTop + header.offsetHeight,
    from,
    shown: from ? 0 : 1,
    onTap: i => pick(i),
    onSwap: (a, b) => { ctx.table.swap(a, b); refresh() },
    onMove: (from, steps) => { ctx.table.shift(from, steps); refresh() },
    onRotate: k => { ctx.table.rotate(k); refresh() }
  })

  // ---- drawer: table controls + game options + start ----
  const startBtn = button(t('table.start'), { variant: 'primary', full: true, onClick: () => cfg.start(ctx) })
  // Everything above the start button travels together, as one block: folded
  // separately they slid into each other and you could see one section's rule
  // cutting through the next.
  const main = el('div', { class: 'drawer-page' }, [
    el('div', { class: 'drawer-more' }, [
      el('div', { class: 'drawer-row' }, [
        pill('plus', t('table.addSeat'), () => { ctx.table.addSeat(); refresh() }),
        pill('players', t('table.addPlayer'), () => openPlayers())
      ]),
      el('div', { class: 'drawer-options' }, options.node)
    ]),
    startBtn
  ])

  function refresh() {
    const seats = ctx.table.seats()
    const roster = new Map(ctx.players.all().map(p => [p.id, p]))
    stage.view.set(seats.map((s, i) => {
      const p = s.pid ? roster.get(s.pid) || null : null
      return { key: s.id, p, name: p ? p.name : t('table.free'), cls: picking === i ? 'on' : '' }
    }))
    stage.view.setCenter(el('div', { class: 'table-count' }, [
      el('b', {}, String(seats.length)),
      el('span', {}, seats.length === 1 ? t('table.seat') : t('table.seats'))
    ]))
    // the button says why it can't start yet
    const msg = seats.length < cfg.min ? t('table.needSeats', { n: cfg.min }) : options.check(seats.length)
    startBtn.textContent = msg || t('table.start')
    startBtn.disabled = !!msg
  }

  // ---- sheet: everyone who isn't at the table yet ----
  // Tapping doesn't close it: you seat six people with six taps and then get
  // out. Each one takes the first free chair, or a new chair if there is none —
  // the order you sort out afterwards, on the table itself.
  function openPlayers() {
    const list = walls(el('div', { class: 'pick-grid list-scroll' }))
    const hint = el('p', { class: 'drawer-hint' }, t('table.playersHint'))
    const empty = el('p', { class: 'drawer-hint' }, t('table.allSeated'))

    function seat(pid) {
      const empty = ctx.table.seats().find(s => !s.pid)
      if (empty) ctx.table.sit(empty.id, pid)
      else ctx.table.addSeat(pid)
      refresh()
      paint()
    }

    function paint() {
      const seated = new Set(ctx.table.seats().map(s => s.pid).filter(Boolean))
      const standing = ctx.players.all().filter(p => !seated.has(p.id))
      // replaceChildren() has no opinion about null — it would print the word.
      const grid = faceGrid(standing, p => seat(p.id),
        newFaceCell(t('common.new'), () => openProfileEditor(ctx, null, p => { if (p) seat(p.id) })))
      list.replaceChildren(...grid.children)
      empty.hidden = standing.length > 0
      hint.hidden = !standing.length
    }

    paint()
    stage.openSheet(el('div', { class: 'drawer-page' }, [
      el('div', { class: 'drawer-title' }, t('hub.players')),
      hint,
      empty,
      list,
      button(t('common.done'), { variant: 'ghost', full: true, onClick: () => stage.closeSheet() })
    ]), { done: () => refresh() })
  }

  // ---- drawer: choose who sits on a chair (or on a new one) ----
  function pick(i) {
    picking = i
    const seats = ctx.table.seats()
    const seat = typeof i === 'number' ? seats[i] : null
    const roster = ctx.players.all()
    const current = seat && seat.pid ? roster.find(p => p.id === seat.pid) : null
    const seated = new Set(seats.map(s => s.pid).filter(Boolean))
    const free = roster.filter(p => !seated.has(p.id))

    function place(pid) {
      if (seat) ctx.table.sit(seat.id, pid)
      else {
        const empty = ctx.table.seats().find(s => !s.pid)
        if (empty) ctx.table.sit(empty.id, pid)
        else ctx.table.addSeat(pid)
      }
      done()
    }

    stage.setDrawer(el('div', { class: 'drawer-page' }, [
      el('div', { class: 'drawer-title' }, seat ? (current ? current.name : t('table.seatFree')) : t('table.whoSits')),
      el('p', { class: 'drawer-hint' }, seat && !current
        ? t('table.pickForSeat')
        : free.length ? t('table.pickProfile') : t('table.allSeated')),
      // same picker as the Giocatori panel: faces in a grid, the new profile
      // last in line instead of hiding behind a pill
      scrollable(faceGrid(free, p => place(p.id),
        newFaceCell(t('common.new'), () => openProfileEditor(ctx, null, p => { if (p) place(p.id) })))),
      el('div', { class: 'drawer-row' }, [
        current ? pill('minus', t('table.free.action'), () => { ctx.table.sit(seat.id, null); done() }) : null,
        seat ? pill('close', t('table.remove'), () => { ctx.table.removeSeat(seat.id); done() }) : null
      ]),
      button(t('common.done'), { variant: 'ghost', full: true, onClick: done })
    ]))
    refresh()
  }

  function done() {
    picking = null
    stage.setDrawer(main)
    refresh()
  }

  stage.setDrawer(main, false)
  refresh()
  const h = stage.open({ slide: !!from })
  // out of the menu: the big circle shrinks into the table, seats appear late
  stage.glide(stage.room(h), from ? { ms: TABLE_MORPH_MS, span: [0.3, 1] } : { ms: 460 })

  return { refit: stage.refit, close: stage.close }
}
