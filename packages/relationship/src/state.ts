import type { RelationshipState } from '@amadeus/contracts'

/**
 * Seed relationship for a brand-new user.
 *
 * This is the single source of truth for the initial state — it used to live
 * hardcoded in the app's createAgent.ts and was relocated here. Kurisu starts
 * out as a wary stranger: a little baseline trust, a flicker of affection, and
 * almost no shared familiarity.
 *
 * Treat this as immutable. Callers that need a mutable copy (e.g. the
 * persistence loader) must clone it via `structuredClone`.
 */
export const INITIAL_RELATIONSHIP: RelationshipState = {
  trust: 10,
  affection: 5,
  familiarity: 3,
  annoyance: 0,
  stage: 'stranger',
}
