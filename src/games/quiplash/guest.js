// The room, seen from a phone that joined it.
//
// This phone knows nothing: it says who it is, asks for things to happen and
// draws whatever the room last told it (the snapshot). All the deciding is in
// the phone that opened the room (game.js) — which is what keeps five phones
// agreeing about whose vote is still missing.
//
// It draws the whole match, not just the buttons: a room with no screen in the
// middle is still a game everybody can follow, each on their own phone.
import { el, clear, icon, button, walls } from '../../shared/ui.js'
import { t } from '../../shared/i18n.js'
import { avatar, faceGrid, newFaceCell, openProfileEditor } from '../../hub/players.js'
import { openRoom, cleanCode } from '../../shared/realtime.js'
import { writeScreen } from './screens.js'

const CODE_KEY = 'quiplash:room'
const ME_KEY = 'quiplash:me'
const KNOCK = 2000 // how often we say hello until the room answers

export function mountGuest(container, ctx, { exit }) {
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
  function openWriter() {
    if (writer || !jobs.length) return
    writer = writeScreen({
      title: '',
      jobs: jobs.map(j => ({ prompt: j.prompt, text: j.text })),
      onSave: (i, text) => {
        sending[i] = text
        if (jobs[i]) jobs[i].text = text
        wire.send('answer', { pid: myPid(), i, text })
      },
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

  // ---------- the screens ----------
  const head = (title, sub) => el('div', { class: 'guest-head' }, [
    el('div', { class: 'guest-title' }, title),
    sub ? el('p', { class: 'drawer-hint' }, sub) : null
  ])

  function shell(children) {
    clear(container)
    const bar = el('div', { class: 'hub-header' }, [
      el('button', { class: 'icon-btn', 'aria-label': t('common.back'), onclick: () => exit() }, icon('back')),
      el('span', { class: 'wordmark game-home-title' }, t('ql.name').toUpperCase()),
      code ? el('span', { class: 'room-code-tag' + (status === 'on' ? '' : ' off') }, code) : null
    ])
    container.append(el('div', { class: 'guest' }, [bar, el('div', { class: 'guest-body' }, children)]))
  }

  // ---------- joining ----------
  function joinScreen() {
    const saved = ctx.storage.get(ME_KEY, null)
    if (!me) me = ctx.players.all().find(p => p.id === saved) || null
    const input = el('input', {
      class: 'text-input code-input', type: 'text', inputmode: 'text',
      autocapitalize: 'characters', autocomplete: 'off', spellcheck: 'false',
      placeholder: '····', maxlength: '6', value: code
    })
    input.addEventListener('input', () => {
      const clean = cleanCode(input.value)
      if (input.value !== clean) input.value = clean
      code = clean
      go.disabled = !(code.length >= 4 && me)
    })

    const go = button(t('ql.join.enter'), {
      variant: 'primary', full: true, disabled: true,
      onClick: () => { if (code.length >= 4 && me) connect() }
    })

    const faces = el('div', { class: 'pick-grid' })
    const paintFaces = () => {
      const grid = faceGrid(ctx.players.all(), p => { me = p; paintFaces(); go.disabled = !(code.length >= 4 && me) },
        newFaceCell(t('common.new'), () => openProfileEditor(ctx, null, p => {
          if (!p) return
          me = p
          paintFaces()
          go.disabled = !(code.length >= 4 && me)
        })))
      faces.replaceChildren(...grid.children)
      for (const cell of faces.children) cell.classList.remove('on')
      const all = ctx.players.all()
      const at = me ? all.findIndex(p => p.id === me.id) : -1
      if (at >= 0 && faces.children[at]) faces.children[at].classList.add('on')
    }
    paintFaces()
    go.disabled = !(code.length >= 4 && me)

    shell([
      head(t('ql.join.title'), t('ql.join.hint')),
      el('span', { class: 'field-label' }, t('ql.join.code')),
      input,
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
    shell([
      head(t('ql.join.knocking', { code }), status === 'off' ? t('ql.room.offline') : t('ql.join.knockingHint')),
      button(t('common.back'), { variant: 'ghost', full: true, onClick: () => exit() })
    ])
  }

  function lobbyScreen() {
    shell([
      head(t('ql.join.inRoom'), t('ql.join.waitStart')),
      el('div', { class: 'guest-people' }, view.players.map(p => el('div', { class: 'guest-person' }, [
        avatar(p, 44),
        el('span', { class: 'pick-name' }, p.name)
      ]))),
      button(t('ql.join.out'), { variant: 'ghost', full: true, onClick: () => { if (wire) wire.send('bye', { pid: myPid() }); exit() } })
    ])
  }

  function writeScreenWaiting() {
    const still = (view.writing || []).map(nameOf)
    const mineLeft = jobs.some(j => !j.text)
    shell([
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

    shell([
      el('p', { class: 'drawer-kicker' }, t('ql.duel.nOf', { n: d.i + 1, of: d.of })),
      el('div', { class: 'guest-prompt' }, d.prompt),
      el('div', { class: 'answer-list guest-answers' }, d.answers.map(row)),
      el('p', { class: 'drawer-hint' },
        canVote ? t('ql.join.pick')
          : voted || myVote ? t('ql.join.voted')
            : t('ql.join.yoursTwo')),
      el('div', { class: 'guest-wait' }, `${d.voted.length}/${d.voters.length}`)
    ])
  }

  function tallyScreen() {
    const d = view.duel
    const best = Math.max(...d.votes)
    shell([
      el('p', { class: 'drawer-kicker' }, t('ql.duel.nOf', { n: d.i + 1, of: d.of })),
      el('div', { class: 'guest-prompt' }, d.prompt),
      el('div', { class: 'answer-list guest-answers' }, d.answers.map((text, slot) => el('div', {
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
    shell([
      head(last
        ? (draw ? t('ql.standings.draw') : t('ql.standings.won', { name: nameOf(leaders[0].pid) }))
        : t('ql.standings.title'),
        last ? '' : t('ql.round.of', { n: view.round + 1, of: view.rounds })),
      el('div', { class: 'rank-list' }, rank.map((r, i) => el('div', {
        class: 'rank-row' + (r.pid === myPid() ? ' lead' : '')
      }, [
        el('span', { class: 'rank-num' }, String(i + 1)),
        el('span', { class: 'rank-name' }, nameOf(r.pid)),
        el('b', { class: 'rank-value' }, String(r.score))
      ]))),
      el('div', { class: 'guest-wait' }, t('ql.join.waitRoom'))
    ])
  }

  function render() {
    if (!container.isConnected || writer) return
    if (!wire) { joinScreen(); return }
    if (closed) {
      shell([
        head(t('ql.join.closed'), t('ql.join.closedHint')),
        button(t('common.back'), { variant: 'primary', full: true, onClick: () => exit() })
      ])
      return
    }
    if (!view) { waitingScreen(); return }
    if (!inMatch()) {
      shell([
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
    clearInterval(knock)
    if (writer) { writer.stop(); writer.remove(); writer = null }
    if (wire) { wire.send('bye', { pid: myPid() }); wire.leave() }
  }
}
