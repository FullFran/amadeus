import type { RelationshipStage } from '@amadeus/contracts'

/**
 * The positive dimensions of a relationship (0..100 each). Annoyance is the
 * single negative dimension and is handled separately as a "hold-back".
 */
interface Dims {
  trust: number
  affection: number
  familiarity: number
  annoyance: number
}

/**
 * A single rung of the stage ladder. To reach a stage, EVERY positive
 * dimension must meet its floor AND the combined positive score must meet the
 * `sum` gate. Higher rungs are listed first so we can pick the highest one the
 * dims qualify for.
 *
 * The `sum` gate prevents a single sky-high dimension from carrying the whole
 * relationship: you can't be "bonded" on trust alone if affection is cold.
 */
interface Rung {
  stage: RelationshipStage
  trust: number
  affection: number
  familiarity: number
  sum: number
}

// Ordered HIGHEST stage first. 'stranger' is the implicit floor (index 0 below).
const LADDER: readonly Rung[] = [
  { stage: 'bonded', trust: 80, affection: 80, familiarity: 80, sum: 255 },
  { stage: 'close', trust: 60, affection: 55, familiarity: 60, sum: 190 },
  { stage: 'familiar', trust: 40, affection: 30, familiarity: 40, sum: 120 },
  { stage: 'acquainted', trust: 20, affection: 12, familiarity: 15, sum: 55 },
]

/**
 * Annoyance "eats into" the positive score before stage gating. High
 * irritation should hold the relationship back even when trust/affection are
 * high. We subtract annoyance from each positive dimension (clamped at 0) so a
 * very annoyed Kurisu narratively regresses.
 */
function penalize(value: number, annoyance: number): number {
  const v = value - annoyance
  return v < 0 ? 0 : v
}

/**
 * Derive the narrative stage from the relationship dimensions.
 *
 * Deterministic and total: always returns one of RELATIONSHIP_STAGES. The rule
 * is monotonic in the positive dimensions (raising trust/affection/familiarity
 * never lowers the stage) and monotonic-downward in annoyance (raising
 * annoyance never raises the stage).
 */
export function narrativeStage(dims: Dims): RelationshipStage {
  const annoyance = clampDim(dims.annoyance)
  const trust = penalize(clampDim(dims.trust), annoyance)
  const affection = penalize(clampDim(dims.affection), annoyance)
  const familiarity = penalize(clampDim(dims.familiarity), annoyance)
  const sum = trust + affection + familiarity

  for (const rung of LADDER) {
    if (
      trust >= rung.trust
      && affection >= rung.affection
      && familiarity >= rung.familiarity
      && sum >= rung.sum
    ) {
      return rung.stage
    }
  }
  return 'stranger'
}

function clampDim(value: number): number {
  if (!Number.isFinite(value))
    return 0
  if (value < 0)
    return 0
  if (value > 100)
    return 100
  return value
}
