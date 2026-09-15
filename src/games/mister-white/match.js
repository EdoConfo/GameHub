// A Mister White match, played around the table: the table stays at the top,
// the drawer below says what to do now.
//   start -> deal -> goddess -> play <-> vote -> results
import { el, button, modal, icon } from '../../shared/ui.js'
import { t } from '../../shared/i18n.js'
import { avatar, openProfileEditor } from '../../hub/players.js'
import {
  ROLE, roleLabel, suggestCounts, fitCounts, maxImpostors, validateSetup,
  buildRound, pickGoddess, checkWinner, guessMatches,
  EXTRAS, extraMin, assignExtras, loverOf, killWithLovers, pickMeme
} from './engine.js'
import packs from './packs.js'

const COUNTS_KEY = 'mister-white:counts'
const EXTRAS_KEY = 'mister-white:extras'

// Which extras are switched on. Stored apart from the counts: they're on/off,
// they don't eat seats, and a table too small simply doesn't get them.
function loadExtras(ctx) {
  const saved = ctx.storage.get(EXTRAS_KEY, {}) || {}
  const out = {}
  for (const id of EXTRAS) out[id] = !!saved[id]
  return out
}

function loadCounts(ctx, n) {
  const c = ctx.storage.get(COUNTS_KEY, null)
  if (c && validateSetup(n, c).ok) return { mrwhite: c.mrwhite, undercover: c.undercover }
  return suggestCounts(n)
}

const page = (children, cls = '') => el('div', { class: 'drawer-page' + (cls ? ' ' + cls : '') }, children)
const count = (big, small) => el('div', { class: 'table-count' }, [el('b', {}, big), el('span', {}, small)])
const pickRow = (list, onPick) => el('div', { class: 'pick-row' }, list.map(p =>
  el('button', { class: 'pick', onclick: () => onPick(p) }, [avatar(p, 48), el('span', { class: 'pick-name' }, p.name)])))

// The round's seats as table items; `look(player, i)` adds cls / note.
function seatItems(api, look) {
  const roster = new Map(api.ctx.players.all().map(p => [p.id, p]))
  return api.state.round.players.map((pl, i) => ({
    key: pl.seat || 'seat-' + i,
    p: pl.pid ? roster.get(pl.pid) || null : null,
    name: pl.name || t('table.free'),
    ...look(pl, i)
  }))
}

// A seat still in the game: eliminated ones show their role; the player who
// starts the clues and the Goddess of Justice carry a note.
function seatLook(pl, { starter, goddess, lit }) {
  if (!pl.alive) return { cls: 'out', note: roleLabel(pl.role) }
  return {
    cls: [lit ? 'on' : '', pl === goddess ? 'dea' : ''].filter(Boolean).join(' '),
    note: [pl === starter ? t('mw.play.starts') : '', pl === goddess ? t('mw.goddess.short') : ''].filter(Boolean).join(' · ')
  }
}

// ---------- before the match: this game's knobs in the hub's table drawer ----------
// The drawer's main page keeps only two doors — Personaggi and Parole — each
// showing what it currently holds. Tapping one opens it as a sub-page of the
// drawer (the drawer changes height, the content fades in): one thing at a
// time, on a phone, with the table still visible above.
//
// Role counts follow the number of seats until you touch them, and never go
// past what the table allows: at least one impostor, civilians in the majority.
// Civilians are not a knob: they're whoever is left.
//
// Word packs are chosen here (only chosen: they're made beforehand, from
// "Parole" in the menu, so nobody at the table has seen them being written).
//   ui.changed(): re-check the table · ui.open(title, content): a drawer sub-page
export function tableOptions(ctx, ui) {
  let n = 0
  let counts = null
  let touched = false
  let paintPage = null // repaints the open sub-page, if one is open
  const extras = loadExtras(ctx)

  // A row of the main page: what it is, what it holds, and a way in.
  function door(label, onClick) {
    const value = el('span', { class: 'opt-value' })
    const node = el('button', { class: 'opt-row opt-door', onclick: onClick }, [
      el('span', { class: 'opt-label' }, label),
      el('span', { class: 'opt-door-value' }, [value, icon('forward')])
    ])
    return { node, set: text => { value.textContent = text } }
  }

  const charactersDoor = door(t('mw.opt.characters'), () => openCharacters())
  const wordsDoor = door(t('mw.opt.words'), () => openPacks())
  const node = el('div', { class: 'opt-list' }, [charactersDoor.node, wordsDoor.node])

  const civilians = () => Math.max(0, n - counts.mrwhite - counts.undercover)

  // "1 Mister White · 3 Civili" — a role nobody is playing isn't named.
  function charactersSummary() {
    const parts = []
    if (counts.mrwhite) parts.push(counts.mrwhite + ' ' + t('mw.role.mrwhite'))
    if (counts.undercover) parts.push(counts.undercover + ' ' + t('mw.role.undercover'))
    parts.push(civilians() + ' ' + t('mw.roles.civili'))
    for (const id of EXTRAS) if (extras[id] && n >= extraMin(id)) parts.push(t('mw.extra.' + id))
    return parts.join(' · ')
  }

  function wordsSummary() {
    const on = packs.enabledPacks()
    return !on.length ? t('mw.opt.choose') : on.length === 1 ? on[0].name : t('mw.opt.nPacks', { n: on.length })
  }

  // ---------- Personaggi: how many of each role ----------
  // One row per role. The ? opens its description right under the row instead
  // of covering the page: you read what a role does with its own count in
  // sight. New roles slot in as more rows, nothing else moves.
  function roleRow({ name, desc, key, extra, fixed }) {
    const info = el('button', {
      class: 'role-info', 'aria-label': t('common.whatItDoes'), 'aria-expanded': 'false',
      onclick: () => {
        const open = info.getAttribute('aria-expanded') === 'true'
        info.setAttribute('aria-expanded', open ? 'false' : 'true')
        descEl.hidden = open
      }
    }, icon('help'))
    const descEl = el('p', { class: 'role-desc', hidden: true }, desc)

    let control, paint
    if (fixed) {
      // always in play, nothing to decide: it's here for its description
      const val = el('span', { class: 'role-rest role-always' }, fixed)
      control = val
      paint = () => {}
    } else if (extra) {
      // on or off, and off for good while the table is too small for it
      const min = extraMin(extra)
      const sw = el('button', {
        class: 'switch', role: 'switch', 'aria-label': name,
        onclick: () => {
          if (n < min) return
          extras[extra] = !extras[extra]
          ctx.storage.set(EXTRAS_KEY, extras)
          ui.changed()
        }
      }, el('span', { class: 'switch-knob' }))
      control = sw
      paint = () => {
        const allowed = n >= min
        const on = allowed && extras[extra]
        sw.classList.toggle('on', on)
        sw.setAttribute('aria-checked', String(on))
        sw.disabled = !allowed
        descEl.textContent = allowed ? desc : desc + ' ' + t('mw.extra.needPlayers', { n: min })
      }
    } else if (key) {
      const other = key === 'mrwhite' ? 'undercover' : 'mrwhite'
      const val = el('span', { class: 'stepper-val' })
      const bump = d => {
        const next = counts[key] + d
        if (next < 0 || next + counts[other] < 1 || next + counts[other] > maxImpostors(n)) return
        counts[key] = next
        touched = true
        ctx.storage.set(COUNTS_KEY, counts)
        ui.changed()
      }
      const minus = el('button', { class: 'round-btn sm', 'aria-label': t('mw.opt.less', { label: name }), onclick: () => bump(-1) }, '−')
      const plus = el('button', { class: 'round-btn sm', 'aria-label': t('mw.opt.more', { label: name }), onclick: () => bump(1) }, '+')
      control = el('div', { class: 'stepper-ctrl' }, [minus, val, plus])
      paint = () => {
        val.textContent = String(counts[key])
        minus.disabled = counts[key] <= 0 || counts[key] + counts[other] <= 1
        plus.disabled = counts[key] + counts[other] >= maxImpostors(n)
      }
    } else {
      // Civilians: a count, not a choice — everyone the impostors leave over.
      const val = el('span', { class: 'role-rest' })
      control = val
      paint = () => { val.textContent = String(civilians()) }
    }

    return {
      node: el('div', { class: 'role-row' }, [
        el('div', { class: 'role-head' }, [info, el('span', { class: 'role-name' }, name), control]),
        descEl
      ]),
      paint
    }
  }

  function openCharacters() {
    const rows = [
      roleRow({ name: t('mw.role.mrwhite'), desc: t('mw.rules.mrwhite'), key: 'mrwhite' }),
      roleRow({ name: t('mw.role.undercover'), desc: t('mw.rules.undercover'), key: 'undercover' }),
      roleRow({ name: t('mw.roles.civili'), desc: t('mw.rules.civili'), key: null }),
      roleRow({ name: t('mw.rules.goddess'), desc: t('mw.rules.goddessDesc'), fixed: t('mw.opt.always') })
    ]
    // The extras go under a line of their own: they're not seats to share out,
    // they're things that happen on top of the roles above.
    const extraRows = [
      roleRow({ name: t('mw.extra.meme'), desc: t('mw.extra.memeDesc'), extra: 'meme' }),
      roleRow({ name: t('mw.extra.lovers'), desc: t('mw.extra.loversDesc'), extra: 'lovers' }),
      roleRow({ name: t('mw.extra.revenger'), desc: t('mw.extra.revengerDesc'), extra: 'revenger' })
    ]
    const all = [...rows, ...extraRows]
    paintPage = () => all.forEach(r => r.paint())
    paintPage()
    ui.open(t('mw.opt.characters'), [
      el('div', { class: 'role-list' }, rows.map(r => r.node)),
      el('h2', { class: 'role-section' }, t('mw.extra.section')),
      el('div', { class: 'role-list' }, extraRows.map(r => r.node)),
      el('p', { class: 'drawer-hint drawer-more' }, t('mw.opt.charactersHint'))
    ])
  }

  // ---------- Parole: which packs this match draws from ----------
  function openPacks() {
    const list = el('div', { class: 'pack-pick-list' })
    paintPage = () => {
      const on = new Set(packs.enabledIds())
      list.replaceChildren(...packs.allPacks().map(p => el('button', {
        class: 'pack-pick' + (on.has(p.id) ? ' on' : ''),
        'aria-pressed': on.has(p.id) ? 'true' : 'false',
        onclick: () => { packs.toggleEnabled(p.id); ui.changed() }
      }, [
        el('span', { class: 'pack-pick-check' }, icon('check')),
        el('span', { class: 'pack-text' }, [
          el('span', { class: 'pack-name' }, p.name),
          el('span', { class: 'pack-count' }, t('mw.opt.nPairs', { n: p.items.length }))
        ])
      ])))
    }
    paintPage()
    ui.open(t('mw.opt.words'), [
      el('p', { class: 'drawer-hint drawer-more' }, t('mw.opt.packsHint')),
      list
    ])
  }

  return {
    node,
    // -> '' when a match can start with `seatCount` seats, else why not
    check(seatCount) {
      if (seatCount !== n) {
        n = seatCount
        if (!counts) counts = loadCounts(ctx, n) // last used, if it still fits
        else if (!touched) counts = suggestCounts(n)
        else counts = fitCounts(n, counts)       // keep your choice, trimmed to the table
        ctx.storage.set(COUNTS_KEY, counts)
      }
      charactersDoor.set(charactersSummary())
      wordsDoor.set(wordsSummary())
      if (paintPage) paintPage()
      const v = validateSetup(n, counts)
      if (!v.ok) return v.message.replace(/\.$/, '')
      if (!packs.enabledItems().length) return t('mw.setup.pickPack')
      return ''
    }
  }
}

// ---------- start: the table's people, roles dealt ----------
export function start(api) {
  const { ctx, state } = api
  const roster = new Map(ctx.players.all().map(p => [p.id, p]))
  const people = ctx.table.seats().map(s => {
    const p = s.pid ? roster.get(s.pid) : null
    return { name: p ? p.name : null, pid: p ? p.id : null, seat: s.id }
  })
  const counts = loadCounts(ctx, people.length)
  const pairs = packs.enabledItems()
  if (!validateSetup(people.length, counts).ok || !pairs.length) { api.toTable(); return }
  const pair = pairs[Math.floor(Math.random() * pairs.length)]
  Object.assign(state, {
    round: assignExtras(buildRound(people, pair, counts), loadExtras(ctx)),
    dealIndex: 0, revealed: false, winner: null, mrWhiteGuess: null, recorded: false, lastOut: null, lastDead: null
  })
  api.goPhase('deal')
}

// ---------- deal: the phone goes round, one word each ----------
export function deal(api, stage) {
  const { state } = api
  const players = state.round.players
  const i = state.dealIndex
  const me = players[i]
  stage.view.set(seatItems(api, (pl, k) => ({ cls: k === i ? 'on' : 'dim' })))
  stage.view.setCenter(count(`${i + 1}/${players.length}`, t('mw.deal.counter')))

  if (!me.pid) { stage.present(joinPage(api, me)); return }

  const next = () => {
    state.revealed = false
    if (i < players.length - 1) { state.dealIndex++; api.render() } else api.goPhase('goddess')
  }
  if (!state.revealed) {
    stage.present(page([
      el('p', { class: 'drawer-kicker' }, t('mw.deal.passTo')),
      el('div', { class: 'drawer-name' }, me.name),
      el('p', { class: 'drawer-hint' }, t('mw.deal.onlyYou')),
      button(t('mw.deal.seeWord'), { variant: 'primary', full: true, onClick: () => { state.revealed = true; api.render() } })
    ], 'steady'))
  } else {
    const last = i === players.length - 1
    stage.present(page([
      ...(me.role === ROLE.MRWHITE
        ? [el('div', { class: 'drawer-word mrwhite' }, t('mw.deal.youAreMrWhite')),
          el('p', { class: 'drawer-hint' }, t('mw.deal.mrWhiteHint'))]
        : [el('p', { class: 'drawer-kicker' }, t('mw.deal.yourWord')),
          el('div', { class: 'drawer-word' }, me.word)]),
      ...extraNotes(state.round, me),
      button(last ? t('mw.deal.hideAndStart') : t('mw.deal.hideAndPass'), { variant: 'secondary', full: true, onClick: next })
    ], 'steady'))
  }
}

// What else this player carries, shown under their word — the only moment
// they're told, and only to them.
function extraNotes(round, me) {
  const notes = []
  const lover = loverOf(round, me.id)
  if (lover) notes.push(el('p', { class: 'drawer-hint' }, t('mw.deal.loverOf', { name: lover.name })))
  if (round.revenger === me.id) notes.push(el('p', { class: 'drawer-hint' }, t('mw.deal.revenger')))
  return notes
}

// An empty chair: whoever got the phone here says who they are first, then
// sees their word. The table keeps them in that seat for next time.
function joinPage(api, me) {
  const { ctx, state } = api
  const seated = new Set(state.round.players.map(p => p.pid).filter(Boolean))
  const free = ctx.players.all().filter(p => !seated.has(p.id))
  const claim = p => {
    me.pid = p.id
    me.name = p.name
    ctx.table.sit(me.seat, p.id)
    api.render()
  }
  return page([
    el('p', { class: 'drawer-kicker' }, t('mw.join.freeSeat')),
    el('div', { class: 'drawer-name' }, t('mw.join.who')),
    el('p', { class: 'drawer-hint' }, free.length ? t('mw.join.pickOrCreate') : t('mw.join.createOnly')),
    free.length ? pickRow(free, claim) : null,
    button(t('mw.join.createMine'), {
      variant: 'primary', full: true,
      onClick: () => openProfileEditor(ctx, null, p => { if (p) claim(p) }, { title: t('mw.join.who') })
    })
  ])
}

// ---------- goddess: everyone has their word — draw the Goddess of Justice ----------
export function goddess(api, stage) {
  const round = api.state.round
  if (!round.goddess) round.goddess = pickGoddess(round.players)
  const g = round.goddess
  stage.view.set(seatItems(api, pl => (pl === g ? { cls: 'on dea', note: t('mw.goddess.short') } : { cls: 'dim' })))
  stage.view.setCenter(el('div', { class: 'table-icon' }, icon('scales')))
  stage.present(page([
    el('p', { class: 'drawer-kicker' }, t('mw.goddess.kicker')),
    el('div', { class: 'drawer-name' }, g.name),
    el('p', { class: 'drawer-hint' }, t('mw.goddess.hint')),
    button(t('mw.goddess.start'), { variant: 'primary', full: true, onClick: () => api.goPhase('play') })
  ], 'steady'))
}

// ---------- play: clues out loud, round the table ----------
export function play(api, stage) {
  const { state } = api
  const round = state.round
  const players = round.players
  const alive = players.filter(p => p.alive)
  // from the first player still in, round the table — never a Mister White
  const inOrder = round.order.map(i => players[i]).filter(p => p.alive)
  const starter = inOrder.find(p => p.role !== ROLE.MRWHITE) || inOrder[0]
  // Mr Meme is drawn again every clue round, among who's still in.
  const meme = round.meme ? pickMeme(players) : null
  round.memeWho = meme ? meme.id : null

  stage.view.set(seatItems(api, pl => {
    const look = seatLook(pl, { starter, goddess: round.goddess, lit: pl === starter })
    if (pl.alive && meme && pl === meme) {
      look.cls = (look.cls + ' meme').trim()
      look.note = [look.note, t('mw.play.memeNote')].filter(Boolean).join(' · ')
    }
    return look
  }))
  stage.view.setCenter(count(String(alive.length), t('mw.play.inGame')))

  // Who fell last time, one line each — a lovers' pair gets its own line too.
  const dead = state.lastDead && state.lastDead.length ? state.lastDead : (state.lastOut ? [state.lastOut] : [])
  const obits = dead.map(d => t('mw.play.wasRole', { name: d.name, role: roleLabel(d.role) }))
  const pair = round.lovers && dead.filter(d => round.lovers.includes(d.id))
  const loversLine = pair && pair.length === 2 ? t('mw.play.loversOut', { a: pair[0].name, b: pair[1].name }) : null
  const news = round.goddessNew ? t('mw.goddess.new', { name: round.goddess.name }) : null
  round.goddessNew = false

  stage.present(page([
    ...obits.map(line => el('p', { class: 'drawer-kicker' }, line)),
    loversLine ? el('p', { class: 'drawer-hint' }, loversLine) : null,
    el('div', { class: 'drawer-title' }, t('mw.play.title')),
    el('p', { class: 'drawer-hint' }, t('mw.play.hint', { name: starter.name })),
    meme ? el('p', { class: 'drawer-hint meme-news' }, t('mw.play.meme', { name: meme.name })) : null,
    news ? el('p', { class: 'drawer-hint dea-news' }, news) : null,
    button(t('mw.play.toVote'), { variant: 'primary', full: true, onClick: () => api.goPhase('vote') })
  ], 'steady'))
}

// ---------- vote: tap on the table who goes; a tie goes to the Goddess ----------
export function vote(api, stage) {
  const { state } = api
  const round = state.round
  const players = round.players
  let chosen = null
  let tie = false

  function paint() {
    const g = round.goddess
    stage.view.set(seatItems(api, (pl, i) => {
      const look = seatLook(pl, { goddess: g, lit: chosen === i || (tie && chosen == null && pl === g) })
      if (pl.alive && chosen != null && chosen !== i) look.cls += ' dim'
      return look
    }))
    let body
    if (chosen != null) {
      body = [
        el('p', { class: 'drawer-kicker' }, tie ? t('mw.vote.goddessEliminates', { name: g.name }) : t('mw.vote.eliminate')),
        el('div', { class: 'drawer-name' }, players[chosen].name + '?'),
        el('div', { class: 'drawer-row' }, [
          button(t('common.cancel'), { variant: 'ghost', onClick: () => { chosen = null; paint() } }),
          button(t('common.delete'), { variant: 'danger', onClick: () => eliminate(players[chosen]) })
        ])
      ]
    } else if (tie) {
      body = [
        el('p', { class: 'drawer-kicker' }, t('mw.vote.tie')),
        el('div', { class: 'drawer-name' }, t('mw.vote.tieDecides', { name: g.name })),
        el('p', { class: 'drawer-hint' }, t('mw.vote.tieHint')),
        button(t('mw.vote.noTie'), { variant: 'ghost', full: true, onClick: () => { tie = false; paint() } })
      ]
    } else {
      body = [
        el('div', { class: 'drawer-title' }, t('mw.vote.title')),
        el('p', { class: 'drawer-hint' }, t('mw.vote.hint', { name: g.name })),
        el('div', { class: 'drawer-row' }, [
          button(t('mw.vote.clues'), { variant: 'ghost', onClick: () => api.goPhase('play') }),
          button(t('mw.vote.tie'), { variant: 'secondary', onClick: () => { tie = true; paint() } })
        ])
      ]
    }
    stage.present(page(body, 'steady'))
  }

  api.onSeat = i => {
    if (!players[i] || !players[i].alive) return
    chosen = chosen === i ? null : i
    paint()
  }
  stage.view.setCenter(count(String(players.filter(p => p.alive).length), t('mw.play.inGame')))
  paint()

  function eliminate(p) {
    if (p.role === ROLE.MRWHITE) askGuess(p)
    else strike(p)
  }

  // One elimination can cost more than one seat: the Lovers bond drags the
  // other half along, and a Revenger among the fallen still gets to point at
  // someone. Everything that falls in one go is announced together.
  function strike(p) {
    const dead = killWithLovers(round, p.id)
    state.lastOut = p
    const avenger = dead.find(d => round.revenger === d.id)
    if (avenger && !round.revengeUsed && players.some(x => x.alive)) {
      round.revengeUsed = true
      askRevenge(avenger, dead)
      return
    }
    settle(dead)
  }

  function askRevenge(avenger, dead) {
    let target = null
    const paintRevenge = () => {
      stage.view.set(seatItems(api, (pl, i) => {
        const look = seatLook(pl, { goddess: round.goddess, lit: target === i })
        if (pl === avenger) look.note = t('mw.revenge.note')
        if (pl.alive && target != null && target !== i) look.cls += ' dim'
        return look
      }))
      stage.present(page([
        el('p', { class: 'drawer-kicker' }, t('mw.revenge.kicker', { name: avenger.name })),
        el('div', { class: 'drawer-name' }, target == null ? '?' : players[target].name),
        el('p', { class: 'drawer-hint' }, t('mw.revenge.hint')),
        button(target == null ? t('mw.revenge.pick') : t('mw.revenge.confirm', { name: players[target].name }), {
          variant: 'danger', full: true, disabled: target == null,
          onClick: () => settle([...dead, ...killWithLovers(round, target)])
        })
      ], 'steady'))
    }
    api.onSeat = i => {
      if (!players[i] || !players[i].alive) return
      target = target === i ? null : i
      paintRevenge()
    }
    paintRevenge()
  }

  function askGuess(p) {
    const input = el('input', { class: 'text-input', type: 'text', placeholder: t('mw.vote.guessPlaceholder') })
    const m = modal({
      title: t('mw.vote.guessTitle', { name: p.name }),
      content: [el('p', {}, t('mw.vote.guessBody')), input],
      actions: [
        button(t('mw.vote.guessWrong'), { variant: 'ghost', onClick: () => { m.close(); strike(p) } }),
        button(t('mw.vote.guessConfirm'), {
          variant: 'primary',
          onClick: () => {
            const correct = guessMatches(input.value, round.pair.civilian)
            m.close()
            state.mrWhiteGuess = { name: p.name, correct }
            if (correct) {
              p.alive = false
              state.lastDead = [p]
              state.winner = 'mrwhite-guess'
              api.goPhase('results')
            } else strike(p)
          }
        })
      ]
    })
    input.focus()
  }

  // The news goes in the next drawer ("Anna era Civile"), not in a toast.
  // If the Goddess herself is out, another one is drawn among who's left.
  function settle(dead) {
    state.lastDead = dead
    if (dead.includes(round.goddess)) { round.goddess = pickGoddess(players); round.goddessNew = true }
    const w = checkWinner(players)
    if (w) { state.winner = w; api.goPhase('results') } else api.goPhase('play')
  }
}

// Who won, as round players.
function winners(state) {
  const players = state.round.players
  if (state.winner === 'civili') return players.filter(p => p.role === ROLE.CIVILE)
  if (state.winner === 'mrwhite-guess') return players.filter(p => p.role === ROLE.MRWHITE)
  return players.filter(p => p.role !== ROLE.CIVILE) // impostori
}

// ---------- results: every role shown at its seat ----------
export function results(api, stage) {
  const { ctx, state } = api
  const players = state.round.players
  const won = new Set(winners(state))

  // Record stats once per finished round.
  if (!state.recorded) {
    state.recorded = true
    const pids = players.map(p => p.pid).filter(Boolean)
    const wins = [...won].map(p => p.pid).filter(Boolean)
    const result = state.winner === 'civili' ? t('mw.results.recCivili')
      : state.winner === 'mrwhite-guess' ? t('mw.results.recMrWhite')
        : t('mw.results.recImpostori')
    if (pids.length) ctx.stats.record('mister-white', pids, wins, { result })
  }

  const [headline, sub] = state.winner === 'civili'
    ? [t('mw.results.civiliWin'), t('mw.results.civiliWinSub')]
    : state.winner === 'mrwhite-guess'
      ? [t('mw.results.mrWhiteWin'), t('mw.results.mrWhiteWinSub', { name: state.mrWhiteGuess.name })]
      : [t('mw.results.impostoriWin'), t('mw.results.impostoriWinSub')]

  stage.view.set(seatItems(api, pl => ({ cls: (won.has(pl) ? 'on' : 'dim') + ' role-' + pl.role, note: roleLabel(pl.role) })))
  stage.view.setCenter(null)
  const { civilian, undercover } = state.round.pair
  const hadUndercover = players.some(p => p.role === ROLE.UNDERCOVER)
  stage.present(page([
    el('div', { class: 'drawer-title' }, headline),
    el('p', { class: 'drawer-hint' }, sub),
    el('div', { class: 'drawer-words' }, [
      el('div', {}, [el('span', {}, t('mw.roles.civili')), el('b', {}, civilian)]),
      hadUndercover ? el('div', {}, [el('span', {}, t('mw.role.undercover')), el('b', {}, undercover)]) : null
    ]),
    button(t('mw.results.replay'), { variant: 'primary', full: true, onClick: () => api.goPhase('start') }),
    el('div', { class: 'drawer-row' }, [
      button(t('mw.results.changeTable'), { variant: 'secondary', onClick: () => api.toTable() }),
      button(t('common.menu'), { variant: 'ghost', onClick: () => api.toMenu() })
    ])
  ]))
}

// Back from the match: free before anyone has seen a word; afterwards it
// would throw the round away, so ask first.
export function leave(api) {
  const { state } = api
  const midRound = state.round && state.phase !== 'results' &&
    (state.phase !== 'deal' || state.dealIndex > 0 || state.revealed)
  if (!midRound) { api.toTable(); return }
  const m = modal({
    title: t('mw.leave.title'),
    content: [el('p', { class: 'muted' }, t('mw.leave.body'))],
    actions: [
      button(t('mw.leave.stay'), { variant: 'ghost', onClick: () => m.close() }),
      button(t('mw.leave.exit'), { variant: 'danger', onClick: () => { m.close(); api.toTable() } })
    ]
  })
}
