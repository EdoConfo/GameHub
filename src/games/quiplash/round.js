// Quiplash as arithmetic: who answers what, who may vote, what a vote is worth.
// No DOM here — match.js draws it, this file decides it.
//
// A round is one prompt per player, and every prompt goes to TWO of them: the
// duels of a round are therefore as many as the players, and everybody writes
// exactly twice. Sitting in a circle, that's "you and the person after you",
// with the circle shuffled first so it isn't always the same neighbour.
import { shuffle } from '../../shared/ui.js'

// Two who write and at least one who votes.
export const MIN_PLAYERS = 3
export const ROUNDS = [1, 2, 3]
export const POINTS_PER_VOTE = 100

// A vote is worth more as the evening goes on, so the last round can still
// turn the match around and nobody is out of it by the second one.
export const multiplier = round => round + 1

// The duels of one round. `prompts` must hold one per player.
//   -> [{ prompt, round, answers: [{ by, text }, { by, text }], votes: {} }]
// `by` and the keys of `votes` are indices into the players list.
export function buildRound(playerCount, prompts, round = 0) {
  const order = shuffle(Array.from({ length: playerCount }, (_, i) => i))
  return order.map((_, i) => ({
    prompt: prompts[i],
    round,
    answers: [
      { by: order[i], text: '' },
      { by: order[(i + 1) % playerCount], text: '' }
    ],
    votes: {}
  }))
}

// What one player has to write this round, in the order the duels come up.
//   -> [{ duel, slot }], two of them
export function jobsFor(duels, player) {
  const jobs = []
  duels.forEach((duel, i) => duel.answers.forEach((a, slot) => {
    if (a.by === player) jobs.push({ duel: i, slot })
  }))
  return jobs
}

// Everyone but the two who wrote it. They're the ones who know both answers,
// so the table can see who they are — which half is whose is the whole game.
export function votersFor(duel, playerCount) {
  return Array.from({ length: playerCount }, (_, i) => i)
    .filter(i => !duel.answers.some(a => a.by === i))
}

export function castVotes(duel, playerCount) {
  return votersFor(duel, playerCount).filter(i => duel.votes[i] === 0 || duel.votes[i] === 1).length
}

// The duel settled: each answer with its votes and what they're worth.
// Taking every single vote is a QUIPLASH — the other answer never stood a
// chance — and it doubles them. It needs at least two voters: at a table of
// three one voter always sweeps, and a sweep that cannot be avoided is not one.
export function tallyDuel(duel, playerCount) {
  const voters = votersFor(duel, playerCount)
  const counts = [0, 0]
  for (const i of voters) { const v = duel.votes[i]; if (v === 0 || v === 1) counts[v]++ }
  const cast = counts[0] + counts[1]
  return duel.answers.map((answer, slot) => {
    const votes = counts[slot]
    const sweep = cast >= 2 && votes === cast
    return {
      ...answer,
      slot,
      votes,
      sweep,
      points: votes * POINTS_PER_VOTE * multiplier(duel.round) * (sweep ? 2 : 1)
    }
  })
}

// The standings: everybody, best first. Ties keep the order they had.
export function ranking(players) {
  return players.map((p, i) => ({ ...p, i })).sort((a, b) => b.score - a.score || a.i - b.i)
}

// Who won — nobody, when the top score is shared.
//   -> { winners: [player, …], draw: boolean }
export function outcome(players) {
  const best = Math.max(...players.map(p => p.score))
  const top = players.filter(p => p.score === best)
  return { winners: top.length === 1 ? top : [], draw: top.length !== 1, best }
}
