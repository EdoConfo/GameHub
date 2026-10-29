// The room, seen from a phone that joined it.
//
// This phone knows nothing: it says who it is, asks for things to happen and
// draws whatever the room last told it (the snapshot). All the deciding is in
// the phone that opened the room (game.js) — which is what keeps five phones
// agreeing about whose vote is still missing.
//
// It draws the whole match, not just the buttons: a room with no screen in the
// middle is still a game everybody can follow, each on their own phone. And
// it draws it the way the room does — on the game's own table, which the
// menu's circle becomes, with everybody in the room sitting round it and the
// drawer under it saying what is happening now.
import { el, button, walls } from '../../shared/ui.js'
import { t } from '../../shared/i18n.js'
import { faceGrid, newFaceCell, openProfileEditor } from '../../hub/players.js'
import { openRoom, cleanCode, CODE_LEN } from '../../shared/realtime.js'
import { codeField } from '../../shared/roomUi.js'
import { writeScreen } from './screens.js'

const CODE_KEY = 'quiplash:room'
const ME_KEY = 'quiplash:me'
const KNOCK = 2000 // how often we say hello until the room answers

const page = (children, cls = '') => el('div', { class: 'drawer-page' + (cls ? ' ' + cls : '') }, children)
const count = (big, small) => el('div', { class: 'table-count' }, [el('b', {}, big), el('span', {}, small)])

export function placeGuest(scene, ctx) {
  const { stage } = scene
  const exit = () => scene.exit()
  let me = null
  let code = ''
  let wire = null
  let view = null        // the room's last snapshot
  let jobs = []          // my own prompts, from the room
  let sending = {}       // answers said but not yet confirmed: { [i]: text }
  let myVote = null      // { duel, slot } until the room shows it registered
  let status = 'wait'
  let closed = false
  let writer = null
  let knock = 0
  let left = false

  const myPid = () => (me ? me.id : null)
  const inMatch = () => !!(view && view.players.some(p => p.pid === myPid()))

  // ---------- talking to the room ----------
  function hello() {
    if (!wire || !me) return
    wire.send('hello', { pid: me.id, name: me.name, color: me.color, emoji: me.emoji })
  }

  function connect() {
    ctx.storage.set(CODE_KEY, code)
    ctx.storage.set(ME_KEY, me.id)
    wire = openRoom(code, {
      onStatus: s => { status = s; render() },
      onMessage: (event, msg) => {
        if (!msg || typeof msg !== 'object') return
        if (event === 'state') { onState(msg); return }
        if (event === 'deal' && msg.to === myPid()) { onDeal(msg.jobs || []); return }
        if (event === 'closed') { closed = true; render() }
      }
    })
    hello()
    // Until the room has us in it, we keep saying hello: it may have been
    // opened a second after we knocked, or our first knock may have gone out
    // while the channel was still joining.
    knock = setInterval(() => { if (!inMatch()) hello() }, KNOCK)
    render()
  }

  function onState(snap) {
    if (!snap || (view && snap.v < view.v && snap.phase === view.phase)) return
    const before = view && view.phase
    view = snap
    closed = false
    // A vote that never arrived: say it again, once the room is showing this
    // same duel and still hasn't counted us.
    if (myVote && snap.duel) {
      if (snap.duel.i !== myVote.duel || snap.duel.done || snap.duel.voted.includes(myPid())) myVote = null
      else wire.send('vote', { pid: myPid(), duel: myVote.duel, slot: myVote.slot })
    }
    if (snap.phase !== 'write' && writer) closeWriter()
    if (snap.phase === 'write' && before !== 'write') { jobs = []; sending = {} }
    render()
  }

  function onDeal(fresh) {
    // What the room has of mine. Anything I said and it hasn't got, I say
    // again — a lost message is the one thing that would leave me out of a
    // duel I answered.
    jobs = fresh
    for (const [i, text] of Object.entries(sending)) {
      if (fresh[i] && fresh[i].text === text) delete sending[i]
      else if (wire) wire.send('answer', { pid: myPid(), i: Number(i), text })
    }
    if (view && view.phase === 'write' && jobs.some(j => !j.text) && !writer) openWriter()
    render()
  }

  // ---------- writing ----------
  // A sheet over the drawer, the table still above it. Pulled down before the
  // answers are in, it leaves them for later: the drawer has a way back.
  function openWriter() {
    if (writer || !jobs.length) return
    const node = writeScreen({
      title: '',
      jobs: jobs.map(j => ({ prompt: j.prompt, text: j.text })),
      onSave: (i, text) => {
        sending[i] = text
        if (jobs[i]) jobs[i].text = text
        wire.send('answer', { pid: myPid(), i, text })
      },
      onDone: () => closeWriter()
    })
    writer = node
    stage.openSheet(node, { done: () => { if (writer === node) { writer = null; node.stop(); render() } } })
    node.ready()
  }

  function closeWriter() {
    if (!writer) return
    const node = writer
    writer = null
    node.stop()
    stage.closeSheet()
    render()
  }

  // ---------- the screens ----------
  const head = (title, sub) => el('div', { class: 'page-head' }, [
    el('div', { class: 'drawer-title' }, title),
    sub ? el('p', { class: 'drawer-hint' }, sub) : null
  ])

  // Everybody in the room round the table, as the room last told it; before
  // that, just me, on an empty table.
  //   look(pid) -> { cls?, note? }
  function seats(look = () => ({})) {
    const list = view && inMatch() ? view.players : me ? [{ pid: me.id, name: me.name, color: me.color, emoji: me.emoji }] : []
    stage.view.set(list.map(p => ({
      key: p.pid,
      p: { name: p.name, color: p.color, emoji: p.emoji },
      name: p.name + (p.pid === myPid() ? ' ' + t('ql.room.youShort') : ''),
      ...look(p.pid)
    })))
  }

  // One page of the drawer. `key` names it: the same page brought up to date
  // (another vote counted) is swapped where it stands, not faded.
  function show(key, children, cls = '') {
    scene.header({ code: wire ? code : '', live: status === 'on' })
    stage.present(page(children, cls), { key })
  }

  // ---------- joining ----------
  function joinScreen() {
    const saved = ctx.storage.get(ME_KEY, null)
    if (!me) me = ctx.players.all().find(p => p.id === saved) || null
    const ready = () => code.length === CODE_LEN && !!me
    const field = codeField(code, clean => { code = clean; go.disabled = !ready() }, t('ql.join.code'))

    const go = button(t('ql.join.enter'), {
      variant: 'primary', full: true, disabled: true,
      onClick: () => { if (ready()) connect() }
    })

    const faces = el('div', { class: 'pick-grid' })
    const paintFaces = () => {
      const grid = faceGrid(ctx.players.all(), p => { me = p; paintFaces(); go.disabled = !ready() },
        newFaceCell(t('common.new'), () => openProfileEditor(ctx, null, p => {
          if (!p) return
          me = p
          paintFaces()
          go.disabled = !ready()
        })))
      faces.replaceChildren(...grid.children)
      for (const cell of faces.children) cell.classList.remove('on')
      const all = ctx.players.all()
      const at = me ? all.findIndex(p => p.id === me.id) : -1
      if (at >= 0 && faces.children[at]) faces.children[at].classList.add('on')
    }
    paintFaces()
    go.disabled = !ready()

    seats()
    stage.view.setCenter(null)
    show('join', [
      head(t('ql.join.title'), t('ql.join.hint')),
      field,
      el('span', { class: 'field-label' }, t('ql.join.who')),
      walls(el('div', { class: 'list-scroll' }, faces)),
      go
    ])
  }

  const nameOf = pid => {
    const p = view && view.players.find(x => x.pid === pid)
    return p ? p.name : '?'
  }

  function waitingScreen() {
    seats()
    show('knock', [
      head(t('ql.join.knocking', { code }), status === 'off' ? t('ql.room.offline') : t('ql.join.knockingHint')),
      button(t('common.back'), { variant: 'ghost', full: true, onClick: () => exit() })
    ])
  }

  function lobbyScreen() {
    // who is in is the table itself: the chairs fill as phones join
    seats(pid => (pid === myPid() ? { cls: 'on' } : {}))
    stage.view.setCenter(count(String(view.players.length), t('ql.room.inRoom')))
    show('lobby', [
      head(t('ql.join.inRoom'), t('ql.join.waitStart')),
      button(t('ql.join.out'), { variant: 'ghost', full: true, onClick: () => { if (wire) wire.send('bye', { pid: myPid() }); exit() } })
    ])
  }

  function writeScreenWaiting() {
    const still = (view.writing || []).map(nameOf)
    const mineLeft = jobs.some(j => !j.text)
    const late = new Set(view.writing || [])
    seats(pid => (late.has(pid) ? { note: t('ql.room.writing') } : { cls: 'on', note: t('ql.room.written') }))
    stage.view.setCenter(count(`${view.players.length - late.size}/${view.players.length}`, t('ql.room.written')))
    show('write', [
      head(mineLeft ? t('ql.join.yourTurn') : t('ql.join.written'),
        mineLeft ? '' : (still.length ? t('ql.room.waitingFor', { names: still.join(', ') }) : t('ql.room.allWritten'))),
      mineLeft
        ? button(t('ql.room.writeMine'), { variant: 'primary', full: true, onClick: () => openWriter() })
        : el('div', { class: 'guest-wait' }, t('ql.join.waitDots'))
    ])
  }

  function duelScreen() {
    const d = view.duel
    const iAmVoter = d.voters.includes(myPid())
    const voted = d.voted.includes(myPid())
    const canVote = iAmVoter && !voted && !d.done

    const row = (text, slot) => el(canVote ? 'button' : 'div', {
      class: 'answer-row team-' + slot + (canVote ? ' pickable' : ''),
      onclick: canVote ? () => {
        myVote = { duel: d.i, slot }
        wire.send('vote', { pid: myPid(), duel: d.i, slot })
        render()
      } : null
    }, [
      el('span', { class: 'team-dot' }),
      el('span', { class: 'answer-text' }, text)
    ])

    const voters = new Set(d.voted)
    seats(pid => (voters.has(pid) ? { cls: 'on', note: t('ql.room.voted') } : {}))
    stage.view.setCenter(count(`${d.voted.length}/${d.voters.length}`, d.voters.length === 1 ? t('ql.duel.vote') : t('ql.duel.votes')))
    show('duel-' + d.i, [
      el('p', { class: 'drawer-kicker' }, t('ql.duel.nOf', { n: d.i + 1, of: d.of })),
      el('div', { class: 'drawer-prompt' }, d.prompt),
      el('div', { class: 'answer-list' }, d.answers.map(row)),
      el('p', { class: 'drawer-hint' },
        canVote ? t('ql.join.pick')
          : voted || myVote ? t('ql.join.voted')
            : t('ql.join.yoursTwo'))
    ])
  }

  function tallyScreen() {
    const d = view.duel
    const best = Math.max(...d.votes)
    seats(pid => {
      const slot = d.authors.indexOf(pid)
      if (slot < 0) return { cls: 'dim' }
      return { cls: d.votes[slot] === best && best > 0 ? 'on' : '', note: d.points[slot] ? '+' + d.points[slot] : t('ql.tally.nothing') }
    })
    stage.view.setCenter(count(`${d.i + 1}/${d.of}`, t('ql.duel.counter')))
    show('tally-' + d.i, [
      el('p', { class: 'drawer-kicker' }, t('ql.duel.nOf', { n: d.i + 1, of: d.of })),
      el('div', { class: 'drawer-prompt' }, d.prompt),
      el('div', { class: 'answer-list' }, d.answers.map((text, slot) => el('div', {
        class: 'answer-row team-' + slot + (d.votes[slot] === best && best > 0 ? ' won' : '')
      }, [
        el('span', { class: 'team-dot' }),
        el('span', { class: 'answer-text' }, text),
        el('span', { class: 'answer-by' }, [
          nameOf(d.authors[slot]),
          d.sweep[slot] ? el('b', { class: 'answer-sweep' }, t('ql.tally.sweep')) : null
        ]),
        el('b', { class: 'answer-votes' }, d.points[slot] ? '+' + d.points[slot] : '0')
      ])))
    ])
  }

  function standingsScreen() {
    const rank = view.rank || []
    const best = rank.length ? rank[0].score : 0
    const leaders = rank.filter(r => r.score === best)
    const draw = leaders.length !== 1
    const last = view.phase === 'over'
    const score = new Map(rank.map(r => [r.pid, r.score]))
    const up = new Set(leaders.map(r => r.pid))
    seats(pid => ({ cls: up.has(pid) ? 'on' : 'dim', note: String(score.get(pid) ?? 0) }))
    stage.view.setCenter(null)
    show('standings-' + view.round, [
      head(last
        ? (draw ? t('ql.standings.draw') : t('ql.standings.won', { name: nameOf(leaders[0].pid) }))
        : t('ql.standings.title'),
        last ? '' : t('ql.round.of', { n: view.round + 1, of: view.rounds })),
      walls(el('div', { class: 'rank-list list-scroll' }, rank.map((r, i) => el('div', {
        class: 'rank-row' + (r.pid === myPid() ? ' lead' : '')
      }, [
        el('span', { class: 'rank-num' }, String(i + 1)),
        el('span', { class: 'rank-name' }, nameOf(r.pid)),
        el('b', { class: 'rank-value' }, String(r.score))
      ])))),
      el('div', { class: 'guest-wait' }, t('ql.join.waitRoom'))
    ])
  }

  function render() {
    if (left) return
    if (!wire) { joinScreen(); return }
    if (closed) {
      seats()
      show('closed', [
        head(t('ql.join.closed'), t('ql.join.closedHint')),
        button(t('common.back'), { variant: 'primary', full: true, onClick: () => exit() })
      ])
      return
    }
    if (!view) { waitingScreen(); return }
    if (!inMatch()) {
      seats()
      show('started', [
        head(t('ql.join.started'), t('ql.join.startedHint')),
        button(t('common.back'), { variant: 'primary', full: true, onClick: () => exit() })
      ])
      return
    }
    if (view.phase === 'lobby') { lobbyScreen(); return }
    if (view.phase === 'write') { writeScreenWaiting(); return }
    if (view.phase === 'duel') { duelScreen(); return }
    if (view.phase === 'tally') { tallyScreen(); return }
    standingsScreen()
  }

  code = cleanCode(ctx.storage.get(CODE_KEY, '') || '')
  render()

  return () => {
    left = true
    clearInterval(knock)
    if (writer) { writer.stop(); writer = null }
    if (wire) { wire.send('bye', { pid: myPid() }); wire.leave() }
  }
}
