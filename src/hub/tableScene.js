import { el, icon, button } from '../shared/ui.js'
import { createTableStage } from '../shared/tableStage.js'
import { avatar, openProfileEditor } from './players.js'

const pill = (glyph, label, onClick) =>
  el('button', { class: 'pill', onclick: onClick }, [icon(glyph), el('span', {}, label)])

// "Gioca": the game's circle shrinks to the top of the screen and becomes the
// table — who sits where, in the order the phone goes round. A drawer rises
// from below with the table controls and this game's options.
//   from: circle B on screen, to morph out of (omit: pick up where it last was)
export function openTableScene(canvas, header, ctx, game, { from } = {}) {
  const cfg = game.table
  const options = cfg.options(ctx, () => refresh()) // { node, check(n) -> '' | message }
  let picking = null // seat index whose chair we're filling, or 'new'

  const stage = createTableStage(canvas, {
    top: () => header.offsetTop + header.offsetHeight,
    from,
    shown: from ? 0 : 1,
    onTap: i => pick(i),
    onMove: (from, steps) => { ctx.table.shift(from, steps); refresh() },
    onRotate: k => { ctx.table.rotate(k); refresh() }
  })

  // ---- drawer: table controls + game options + start ----
  const startBtn = button('Inizia', { variant: 'primary', full: true, onClick: () => cfg.start(ctx) })
  const main = el('div', { class: 'drawer-page' }, [
    el('div', { class: 'drawer-more drawer-row' }, [
      pill('plus', 'Sedia', () => { ctx.table.addSeat(); refresh() }),
      pill('players', 'Giocatore', () => pick('new'))
    ]),
    el('p', { class: 'drawer-more drawer-hint' }, 'Porta un giocatore tra altri due, o gira il tavolo'),
    el('div', { class: 'drawer-more drawer-options' }, options.node),
    startBtn
  ])

  function refresh() {
    const seats = ctx.table.seats()
    const roster = new Map(ctx.players.all().map(p => [p.id, p]))
    stage.view.set(seats.map((s, i) => {
      const p = s.pid ? roster.get(s.pid) || null : null
      return { key: s.id, p, name: p ? p.name : 'libero', cls: picking === i ? 'on' : '' }
    }))
    stage.view.setCenter(el('div', { class: 'table-count' }, [
      el('b', {}, String(seats.length)),
      el('span', {}, seats.length === 1 ? 'posto' : 'posti')
    ]))
    // the button says why it can't start yet
    const msg = seats.length < cfg.min ? `Servono almeno ${cfg.min} posti` : options.check(seats.length)
    startBtn.textContent = msg || 'Inizia'
    startBtn.disabled = !!msg
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
      el('div', { class: 'drawer-title' }, seat ? (current ? current.name : 'Posto libero') : 'Chi si siede?'),
      el('p', { class: 'drawer-hint' }, seat && !current
        ? 'Scegli chi siede qui, o lascialo libero: chi lo trova si presenta quando riceve il telefono.'
        : free.length ? 'Scegli un profilo o creane uno nuovo.' : 'Tutti i profili sono già al tavolo: creane uno nuovo.'),
      free.length ? el('div', { class: 'pick-row' }, free.map(p =>
        el('button', { class: 'pick', onclick: () => place(p.id) }, [avatar(p, 48), el('span', { class: 'pick-name' }, p.name)])
      )) : null,
      el('div', { class: 'drawer-row' }, [
        pill('plus', 'Nuovo', () => openProfileEditor(ctx, null, p => { if (p) place(p.id) })),
        current ? pill('minus', 'Libera', () => { ctx.table.sit(seat.id, null); done() }) : null,
        seat ? pill('close', 'Togli', () => { ctx.table.removeSeat(seat.id); done() }) : null
      ]),
      button('Fatto', { variant: 'ghost', full: true, onClick: done })
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
  stage.glide(stage.room(h), from ? { ms: 780, span: [0.3, 1] } : { ms: 460 })

  return { refit: stage.refit, close: stage.close }
}
