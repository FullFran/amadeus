import type { RelationshipDelta, RelationshipState } from '@amadeus/contracts'

import { narrativeStage } from './narrativeStage.js'

const DELTA_MIN = -10
const DELTA_MAX = 10
const DIM_MIN = 0
const DIM_MAX = 100

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value))
    return min
  if (value < min)
    return min
  if (value > max)
    return max
  return value
}

/**
 * Apply a relationship delta to a state, returning a NEW state (the input is
 * never mutated).
 *
 * Pipeline:
 *   1. Clamp each delta field into [-10,10] — defensive against an LLM that
 *      emits absurd values like trust:+999.
 *   2. Add each clamped delta to its matching dimension.
 *   3. Clamp each resulting dimension into [0,100].
 *   4. Recompute the narrative stage from the new dimensions.
 */
export function applyDelta(
  state: RelationshipState,
  delta: RelationshipDelta,
): RelationshipState {
  const trust = clamp(
    state.trust + clamp(delta.trust, DELTA_MIN, DELTA_MAX),
    DIM_MIN,
    DIM_MAX,
  )
  const affection = clamp(
    state.affection + clamp(delta.affection, DELTA_MIN, DELTA_MAX),
    DIM_MIN,
    DIM_MAX,
  )
  const familiarity = clamp(
    state.familiarity + clamp(delta.familiarity, DELTA_MIN, DELTA_MAX),
    DIM_MIN,
    DIM_MAX,
  )
  const annoyance = clamp(
    state.annoyance + clamp(delta.annoyance, DELTA_MIN, DELTA_MAX),
    DIM_MIN,
    DIM_MAX,
  )

  return {
    trust,
    affection,
    familiarity,
    annoyance,
    stage: narrativeStage({ trust, affection, familiarity, annoyance }),
  }
}
