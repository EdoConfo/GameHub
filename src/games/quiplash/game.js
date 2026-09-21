// The match, as one phone holds it.
//
// Somebody has to be right about what is going on — who is in, what they
// wrote, whose vote is still missing — and on a party game that somebody is
// the phone that opened the room. It keeps the whole match here and tells the
// others what they need to know (snapshot); the other phones only ever ask for
// something to happen. Nothing is stored anywhere else, so closing the room
// closes the match, and that is the whole lifetime of it.
//
// No DOM in this file: it is the rules with a memory. room.js draws it,
// guest.js draws the little of it a player's phone needs.
import { shuffle } from '../../shared/ui.js'
import { MIN_PLAYERS, buildRound, drawPrompts, jobsFor, votersFor, tallyDuel, ranking, outcome } from './round.js'

export { MIN_PLAYERS }

// What a player who never answered ends up with. It reads as an answer nobody
// wrote, which is exactly what it is, and it can still be voted for — badly.
export const BLANK = '…'

//   prompts: the pool this match draws from
//   rounds:  how many times round
//   onChange(): something moved — broadcast it and redraw
export function createGame({ prompts, rounds = 2, onChange = () => {} } = {}) {
  const state = {
    v: 0,
    phase: 'lobby',     // lobby · write · duel · tally · standings · over
    rounds,
    round: 0,
    players: [],        // { pid, name, color, emoji, score }
    pool: shuffle(prompts || []),
    cursor: 0,
    duels: [],
    duelIndex: 0
  }

  const at = pid => state.players.findIndex(p => p.pid === pid)
  const pidOf = i => (state.players[i] ? state.players[i].pid : null)
  const changed = () => { state.v++; onChange() }

  function beginRound() {
    state.duels = buildRound(state.players.length, drawPrompts(state, state.players.length), state.round)
    state.duelIndex = 0
    state.phase = 'write'
  }

  // Everybody's two answers are in (or were closed): on to the first duel.
  const missingAnswers = () => state.duels.reduce((n, d) => n + d.answers.filter(a => !a.text).length, 0)

  function maybeStartDuels() {
    if (missingAnswers()) return
    state.phase = 'duel'
  }

  const currentDuel = () => state.duels[state.duelIndex] || null

  function stillToVote(duel) {
    if (!duel) return []
    return votersFor(duel, state.players.length).filter(k => duel.votes[k] == null)
  }

  function scoreDuel(duel) {
    if (duel.scored) return tallyDuel(duel, state.players.length)
    const rows = tallyDuel(duel, state.players.length)
    duel.scored = true
    for (const r of rows) state.players[r.by].score += r.points
    return rows
  }

  const api = {
    state,

    // ---- who is playing ----
    // Somebody arrives, or comes back after their phone locked: the same
    // profile id is the same player, with the same score and the same answers
    // still waiting to be written.
    join({ pid, name, color, emoji }) {
      if (!pid || !name) return null
      const i = at(pid)
      if (i >= 0) {
        const p = state.players[i]
        if (p.name !== name || p.color !== color || p.emoji !== emoji) {
          Object.assign(p, { name, color, emoji })
          changed()
        }
        return p
      }
      if (state.phase !== 'lobby') return null // a match that has started is closed
      const p = { pid, name, color: color || null, emoji: emoji || null, score: 0 }
      state.players.push(p)
      changed()
      return p
    },

    // Only from the lobby: mid-match a player who walks off is still in the
    // duels they wrote, and taking them out would leave answers with no author.
    leave(pid) {
      if (state.phase !== 'lobby') return
      const i = at(pid)
      if (i < 0) return
      state.players.splice(i, 1)
      changed()
    },

    // -> '' when the match can start, else why not
    ready() {
      if (state.players.length < MIN_PLAYERS) return 'players'
      if (state.pool.length < state.players.length) return 'prompts'
      return ''
    },

    begin() {
      if (state.phase !== 'lobby' || api.ready()) return
      state.round = 0
      for (const p of state.players) p.score = 0
      beginRound()
      changed()
    },

    // ---- writing ----
    // What this player has to write, with whatever they have written so far.
    //   -> [{ prompt, text }] — two of them, in the order they answer
    deal(pid) {
      const k = at(pid)
      if (k < 0 || !state.duels.length) return []
      return jobsFor(state.duels, k).map(j => ({
        prompt: state.duels[j.duel].prompt,
        text: state.duels[j.duel].answers[j.slot].text
      }))
    },

    answer(pid, i, text) {
      if (state.phase !== 'write') return false
      const k = at(pid)
      if (k < 0) return false
      const job = jobsFor(state.duels, k)[i]
      if (!job) return false
      const clean = String(text || '').trim().slice(0, 90)
      if (!clean) return false
      state.duels[job.duel].answers[job.slot].text = clean
      maybeStartDuels()
      changed()
      return true
    },

    // Who is still writing, by pid — the room shows it so nobody is waited on
    // in silence.
    writing() {
      const out = []
      state.players.forEach((p, k) => {
        const jobs = jobsFor(state.duels, k)
        if (jobs.some(j => !state.duels[j.duel].answers[j.slot].text)) out.push(p.pid)
      })
      return out
    },

    // One person is staring at the ceiling and everybody else is waiting: the
    // room can close the writing. What they didn't write stays blank, and a
    // blank answer is going to lose.
    closeWriting() {
      if (state.phase !== 'write') return
      for (const d of state.duels) for (const a of d.answers) if (!a.text) a.text = BLANK
      maybeStartDuels()
      changed()
    },

    // ---- voting ----
    vote(pid, duelIndex, slot) {
      if (state.phase !== 'duel') return false
      if (duelIndex !== state.duelIndex) return false // a late tap on the duel before
      const d = currentDuel()
      const k = at(pid)
      if (!d || k < 0) return false
      if (d.answers.some(a => a.by === k)) return false // you wrote one of them
      if (slot !== 0 && slot !== 1) return false
      if (d.votes[k] != null) return false             // a vote is cast once
      d.votes[k] = slot
      if (!stillToVote(d).length) { scoreDuel(d); state.phase = 'tally' }
      changed()
      return true
    },

    closeVote() {
      if (state.phase !== 'duel') return
      const d = currentDuel()
      if (!d) return
      scoreDuel(d)
      state.phase = 'tally'
      changed()
    },

    // ---- forward ----
    // The room's own button: the next duel, the standings, the next round.
    //
    // 'standings' is the pause between two rounds and always has a round after
    // it; the last one is 'over'. Told apart here and not at the button,
    // because both screens are the same list of names and only the way out of
    // it differs — and a "Giro 2" under the winner of a one-round match is how
    // that goes wrong.
    next() {
      if (state.phase === 'tally') {
        if (state.duelIndex + 1 < state.duels.length) { state.duelIndex++; state.phase = 'duel' }
        else state.phase = state.round + 1 < state.rounds ? 'standings' : 'over'
        changed()
        return
      }
      if (state.phase === 'standings') {
        state.round++
        beginRound()
        changed()
      }
    },

    // Same room, same people, a clean match.
    again() {
      state.round = 0
      state.duels = []
      state.duelIndex = 0
      for (const p of state.players) p.score = 0
      state.phase = 'lobby'
      changed()
    },

    over() { return state.phase === 'over' },
    outcome() { return outcome(state.players) },
    ranking() { return ranking(state.players) },

    // ---- what the other phones are told ----
    // Everything here is public on purpose. Who wrote which answer is NOT in
    // it until the tally: that's the one thing worth keeping for ten seconds.
    snapshot() {
      const d = currentDuel()
      const showing = state.phase === 'duel' || state.phase === 'tally'
      const rows = showing && state.phase === 'tally' ? tallyDuel(d, state.players.length) : null
      return {
        v: state.v,
        phase: state.phase,
        round: state.round,
        rounds: state.rounds,
        players: state.players.map(p => ({ pid: p.pid, name: p.name, color: p.color, emoji: p.emoji, score: p.score })),
        writing: state.phase === 'write' ? api.writing() : null,
        duel: showing && d ? {
          i: state.duelIndex,
          of: state.duels.length,
          prompt: d.prompt,
          answers: d.answers.map(a => a.text),
          // who may vote, and who already has — never what they voted, or the
          // last to vote would be voting with the count in front of them
          voters: votersFor(d, state.players.length).map(pidOf),
          voted: votersFor(d, state.players.length).filter(k => d.votes[k] != null).map(pidOf),
          done: state.phase === 'tally',
          authors: rows ? rows.map(r => pidOf(r.by)) : null,
          votes: rows ? rows.map(r => r.votes) : null,
          points: rows ? rows.map(r => r.points) : null,
          sweep: rows ? rows.map(r => r.sweep) : null
        } : null,
        rank: (state.phase === 'standings' || state.phase === 'over')
          ? ranking(state.players).map(p => ({ pid: p.pid, score: p.score }))
          : null
      }
    }
  }

  return api
}
