// The room, seen from the phone that opened it.
//
// This phone is the one that knows: it holds the match (game.js), tells the
// others what they may see, and does what they ask. It is also the screen —
// the table with everybody round it, the prompt, the two answers — so a table
// with a tablet in the middle plays like Quiplash always has.
//
// And it can hold a player of its own ("Gioco anch'io"), which is how a room
// works with no screen at all: five phones, one of them also the host.
import { el, icon, button, walls } from '../../shared/ui.js'
import { t } from '../../shared/i18n.js'
import { createTableStage } from '../../shared/tableStage.js'
import { faceGrid, newFaceCell, openProfileEditor } from '../../hub/players.js'
import { openRoom, newCode } from '../../shared/realtime.js'
import { createGame } from './game.js'
import { writeScreen } from './screens.js'
import { matchOptions, loadOptions } from './match.js'
import packs from './packs.js'

const CODE_KEY = 'quiplash:room'
const BEAT = 2500 // how often the room repeats itself, for whoever missed it

const page = (children, cls = '') => el('div', { class: 'drawer-page' + (cls ? ' ' + cls : '') }, children)
const count = (big, small) => el('div', { class: 'table-count' }, [el('b', {}, big), el('span', {}, small)])

// The room's screen. Returns the cleanup the router calls on the way out.
export function mountRoom(container, ctx, { exit }) {
  const code = newCode()
  ctx.storage.set(CODE_KEY, code) // so "Entra" on another phone of the house offers it

  const options = loadOptions(ctx)
  const game = createGame({
    prompts: packs.enabledItems(),
    rounds: options.rounds,
    onChange: () => { publish(); render() }
  })

  let mine = null         // the profile this phone plays as, if it plays
  let writer = null       // the writing screen, while this phone is writing
  let status = 'wait'     // is this phone actually in its own room?
  let beat = 0
  let stage = null
  let ro = null
  let lastPhase = null
  let recorded = false

  // ---------- the wire ----------
  const wire = openRoom(code, {
    onStatus: s => { status = s; if (!writer) render() },
    onMessage: (event, msg) => {
      if (!msg || typeof msg !== 'object') return
      if (event === 'hello') {
        game.join({ pid: msg.pid, name: msg.name, color: msg.color, emoji: msg.emoji })
        // Whether they are new or coming back, they need the state and their
        // own prompts — and a `hello` is exactly the moment to send both.
        publish()
        dealTo(msg.pid)
        return
      }
      if (event === 'bye') { game.leave(msg.pid); return }
      if (event === 'answer') {
        if (game.answer(msg.pid, msg.i, msg.text)) dealTo(msg.pid)
        else dealTo(msg.pid) // already in, or too late: let them see where they are
        return
      }
      if (event === 'vote') { game.vote(msg.pid, msg.duel, msg.slot); return }
    }
  })

  const publish = () => wire.send('state', game.snapshot())
  // What only that player may see: their own prompts. Everybody's phone gets
  // the message — the one next to you cannot read it, a laptop with the
  // console open can. This is a game among friends, not a bank.
  const dealTo = pid => wire.send('deal', { to: pid, jobs: game.deal(pid) })

  // The room repeats itself on a slow beat: a phone that arrives late, or
  // whose screen was off, catches up without anybody doing anything.
  beat = setInterval(() => {
    publish()
    if (game.state.phase === 'write') for (const p of game.state.players) dealTo(p.pid)
  }, BEAT)

  // ---------- the screen ----------
  const header = el('div', { class: 'hub-header' }, [
    el('button', { class: 'icon-btn', 'aria-label': t('common.back'), onclick: () => leave() }, icon('back')),
    el('span', { class: 'wordmark game-home-title' }, t('ql.name').toUpperCase()),
    el('span', { class: 'room-code-tag' }, code)
  ])
  const shell = el('div', { class: 'canvas' }, [header])
  container.append(shell)
  stage = createTableStage(shell, { top: () => header.offsetTop + header.offsetHeight })
  ro = new ResizeObserver(() => { if (stage) stage.refit() })
  ro.observe(shell)

  // The two doors every match has — what it draws from, how long it runs —
  // in this drawer instead of the table's.
  const opts = matchOptions(ctx, {
    changed: () => render(),
    open: (title, content) => stage.openSheet(el('div', { class: 'drawer-page' }, [
      el('div', { class: 'drawer-title' }, title),
      ...content,
      button(t('common.done'), { variant: 'ghost', full: true, onClick: () => stage.closeSheet() })
    ]), { done: () => render() })
  })

  // ---------- the table: everybody in the room ----------
  function seats(note) {
    const list = game.state.players
    if (!list.length) return []
    return list.map(p => {
      const look = note ? note(p) || {} : {}
      return {
        key: p.pid,
        p: { name: p.name, color: p.color, emoji: p.emoji },
        name: p.name + (mine && p.pid === mine.id ? ' ' + t('ql.room.youShort') : ''),
        note: look.note || '',
        cls: look.cls || ''
      }
    })
  }

  // ---------- I am playing too ----------
  function openMine() {
    const list = ctx.players.all()
    const pick = p => {
      mine = p
      game.join({ pid: p.id, name: p.name, color: p.color, emoji: p.emoji })
      stage.closeSheet()
      render()
    }
    stage.openSheet(el('div', { class: 'drawer-page' }, [
      el('div', { class: 'drawer-title' }, t('ql.room.mineTitle')),
      el('p', { class: 'drawer-hint' }, t('ql.room.mineHint')),
      walls(el('div', { class: 'pick-grid list-scroll' },
        [...faceGrid(list, p => pick(p), newFaceCell(t('common.new'), () =>
          openProfileEditor(ctx, null, p => { if (p) pick(p) }))).children])),
      button(t('common.done'), { variant: 'ghost', full: true, onClick: () => stage.closeSheet() })
    ]), { done: () => render() })
  }

  function dropMine() {
    if (!mine) return
    game.leave(mine.id)
    mine = null
    render()
  }

  // ---------- writing, when this phone is one of the players ----------
  function openWriter() {
    if (writer || !mine) return
    const jobs = game.deal(mine.id)
    if (!jobs.length || jobs.every(j => j.text)) return
    writer = writeScreen({
      title: mine.name,
      jobs,
      onSave: (i, text) => game.answer(mine.id, i, text),
      onDone: () => closeWriter()
    })
    container.append(writer)
    writer.ready()
  }

  function closeWriter() {
    if (!writer) return
    writer.stop()
    writer.remove()
    writer = null
    render()
  }

  // ---------- the drawer, phase by phase ----------
  function lobby() {
    opts.paint() // the two doors say what they hold
    const problem = opts.problem(game.state.players.length)
    stage.view.set(seats(() => ({})))
    const mineRow = el('button', {
      class: 'opt-row opt-door',
      onclick: () => (mine ? dropMine() : openMine())
    }, [
      el('span', { class: 'opt-label' }, t('ql.room.mine')),
      el('span', { class: 'opt-door-value' }, [
        el('span', { class: 'opt-value' }, mine ? mine.name : t('ql.room.mineNo')),
        icon('forward')
      ])
    ])

    stage.view.setCenter(count(String(game.state.players.length), t('ql.room.inRoom')))
    stage.present(page([
      el('div', { class: 'drawer-more' }, [
        el('div', { class: 'room-code' }, [
          el('span', { class: 'room-code-label' }, t('ql.room.codeLabel')),
          el('b', {}, code)
        ]),
        el('p', { class: 'drawer-hint' + (status === 'off' ? ' room-off' : '') },
          t(status === 'on' ? 'ql.room.codeHint' : status === 'off' ? 'ql.room.offline' : 'ql.room.opening')),
        el('div', { class: 'opt-list' }, [mineRow, opts.node])
      ]),
      button(problem || t('ql.room.begin'), {
        variant: 'primary', full: true, disabled: !!problem,
        onClick: () => game.begin()
      })
    ]))
  }

  function writing() {
    const late = game.writing()
    const names = game.state.players.filter(p => late.includes(p.pid)).map(p => p.name)
    const mineLate = mine && late.includes(mine.id)

    stage.view.set(seats(p => late.includes(p.pid)
      ? { note: t('ql.room.writing') }
      : { cls: 'on', note: t('ql.room.written') }))
    stage.view.setCenter(count(
      `${game.state.players.length - names.length}/${game.state.players.length}`,
      t('ql.room.written')
    ))

    stage.present(page([
      el('div', { class: 'drawer-title' }, t('ql.room.writeTitle')),
      el('p', { class: 'drawer-hint' }, names.length ? t('ql.room.waitingFor', { names: names.join(', ') }) : t('ql.room.allWritten')),
      mineLate
        ? button(t('ql.room.writeMine'), { variant: 'primary', full: true, onClick: () => openWriter() })
        : button(t('ql.room.closeWriting', { n: names.length }), {
          variant: names.length ? 'secondary' : 'primary', full: true,
          onClick: () => game.closeWriting()
        })
    ]))
  }

  function duel() {
    const s = game.snapshot()
    const d = s.duel
    const voted = new Set(d.voted)
    const voters = new Set(d.voters)
    const iVote = mine && voters.has(mine.id) && !voted.has(mine.id)

    // Who has voted, and nothing else: the two who wrote stay unmarked, or the
    // table would know whose answers these are before the vote.
    stage.view.set(seats(p => (voted.has(p.pid) ? { cls: 'on', note: t('ql.room.voted') } : {})))
    stage.view.setCenter(count(`${d.voted.length}/${d.voters.length}`, d.voters.length === 1 ? t('ql.duel.vote') : t('ql.duel.votes')))

    const answer = (text, slot) => el(iVote ? 'button' : 'div', {
      class: 'answer-row team-' + slot + (iVote ? ' pickable' : ''),
      onclick: iVote ? () => { game.vote(mine.id, d.i, slot) } : null
    }, [
      el('span', { class: 'team-dot' }),
      el('span', { class: 'answer-text' }, text)
    ])

    stage.present(page([
      el('p', { class: 'drawer-kicker' }, t('ql.duel.nOf', { n: d.i + 1, of: d.of })),
      el('div', { class: 'drawer-prompt' }, d.prompt),
      el('div', { class: 'answer-list' }, d.answers.map(answer)),
      el('p', { class: 'drawer-hint' }, iVote ? t('ql.room.yourVote') : t('ql.room.theirVote')),
      button(t('ql.room.closeVote'), { variant: 'secondary', full: true, onClick: () => game.closeVote() })
    ]))
  }

  function tally() {
    const d = game.snapshot().duel
    const by = new Map(game.state.players.map(p => [p.pid, p]))
    const best = Math.max(...d.votes)

    stage.view.set(seats(p => {
      const slot = d.authors.indexOf(p.pid)
      if (slot < 0) return { cls: 'dim' }
      return { cls: d.votes[slot] === best && best > 0 ? 'on' : '', note: d.points[slot] ? '+' + d.points[slot] : t('ql.tally.nothing') }
    }))
    stage.view.setCenter(count(`${d.i + 1}/${d.of}`, t('ql.duel.counter')))

    stage.present(page([
      el('p', { class: 'drawer-hint' }, d.prompt),
      el('div', { class: 'answer-list' }, d.answers.map((text, slot) => el('div', {
        class: 'answer-row team-' + slot + (d.votes[slot] === best && best > 0 ? ' won' : '')
      }, [
        el('span', { class: 'team-dot' }),
        el('span', { class: 'answer-text' }, text),
        el('span', { class: 'answer-by' }, [
          (by.get(d.authors[slot]) || {}).name || '—',
          d.sweep[slot] ? el('b', { class: 'answer-sweep' }, t('ql.tally.sweep')) : null
        ]),
        el('b', { class: 'answer-votes' }, d.points[slot] ? '+' + d.points[slot] : '0')
      ]))),
      button(d.i + 1 < d.of ? t('ql.tally.next') : t('ql.tally.standings'), {
        variant: 'primary', full: true, onClick: () => game.next()
      })
    ]))
  }

  function standings() {
    const order = game.ranking()
    const { winners, draw } = game.outcome()
    const last = game.state.phase === 'over'
    const up = new Set((last && !draw ? winners : [order[0]]).map(p => p.pid))

    // Written down once, and only when the match is really over.
    if (game.state.phase === 'over' && !recorded) {
      recorded = true
      const everyone = game.state.players.map(p => p.pid).filter(pid => ctx.players.get(pid))
      const won = winners.map(p => p.pid).filter(pid => ctx.players.get(pid))
      if (everyone.length) {
        ctx.stats.record('quiplash', everyone, won, {
          result: draw ? t('ql.standings.draw') : t('ql.standings.won', { name: winners[0].name })
        })
      }
    }

    stage.view.set(seats(p => ({ cls: up.has(p.pid) ? 'on' : 'dim', note: String(p.score) })))
    stage.view.setCenter(null)

    stage.present(page([
      el('div', { class: 'drawer-title' }, last
        ? (draw ? t('ql.standings.draw') : t('ql.standings.won', { name: winners[0].name }))
        : t('ql.standings.title')),
      !last ? el('p', { class: 'drawer-hint' }, t('ql.round.of', { n: game.state.round + 1, of: game.state.rounds })) : null,
      walls(el('div', { class: 'rank-list list-scroll' }, order.map((p, i) => el('div', {
        class: 'rank-row' + (up.has(p.pid) ? ' lead' : '')
      }, [
        el('span', { class: 'rank-num' }, String(i + 1)),
        el('span', { class: 'rank-name' }, p.name),
        el('b', { class: 'rank-value' }, String(p.score))
      ])))),
      game.state.phase === 'over'
        ? el('div', { class: 'row stack' }, [
          button(t('ql.standings.again'), { variant: 'primary', full: true, onClick: () => game.again() }),
          button(t('ql.room.close'), { variant: 'secondary', full: true, onClick: () => leave() })
        ])
        : button(t('ql.standings.next', { n: game.state.round + 2 }), {
          variant: 'primary', full: true, onClick: () => game.next()
        })
    ]))
  }

  function render() {
    if (!stage || !container.isConnected) return
    const phase = game.state.phase
    const was = lastPhase
    lastPhase = phase
    if (phase === 'lobby') { lobby(); return }
    if (phase === 'write') {
      writing()
      // This phone is a player too and hasn't written yet: its own screen
      // comes up by itself the first time, so nobody has to find a button.
      if (mine && was !== 'write') openWriter()
      return
    }
    if (phase === 'duel') { duel(); return }
    if (phase === 'tally') { tally(); return }
    standings()
  }

  // The room closes with the phone that opened it: there is nowhere else the
  // match is kept, and the others are told so rather than left waiting.
  function leave() { exit() }

  render()
  publish()

  return () => {
    clearInterval(beat)
    if (writer) { writer.stop(); writer.remove(); writer = null }
    wire.send('closed', { code })
    wire.leave()
    if (ro) ro.disconnect()
    if (stage) stage.destroy()
  }
}
