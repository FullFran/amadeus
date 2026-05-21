export const RELATIONSHIP_STAGES = [
  'stranger',
  'acquainted',
  'familiar',
  'close',
  'bonded',
] as const

export type RelationshipStage = typeof RELATIONSHIP_STAGES[number]

/**
 * Per-turn change to the relationship dimensions emitted by the assistant.
 *
 * Each field is bounded to roughly [-10, 10] by convention. The runtime is
 * responsible for clamping when applied to {@link RelationshipState}.
 */
export interface RelationshipDelta {
  /** Change in trust this turn. Negative withdraws, positive deepens. */
  trust: number
  /** Change in affection this turn. */
  affection: number
  /** Change in shared context / how well Kurisu knows the user. */
  familiarity: number
  /** Change in annoyance — spikes on rude / repeated / pushy turns. */
  annoyance: number
}

/**
 * Persistent emotional/relational state. All dimensional fields are 0..100.
 * The narrative {@link RelationshipStage} is derived from the dimensions.
 */
export interface RelationshipState {
  trust: number
  affection: number
  familiarity: number
  annoyance: number
  stage: RelationshipStage
}
