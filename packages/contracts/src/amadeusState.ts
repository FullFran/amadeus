import type { MemoryCandidate } from './memory.js'
import type { Mood } from './mood.js'
import type { RelationshipDelta } from './relationship.js'

/**
 * The structured payload Amadeus emits in the hidden <amadeus_state> block
 * at the tail of every assistant response. Parsed by
 * {@link ./parseAmadeusState!parseAmadeusState}.
 */
export interface AmadeusState {
  mood: Mood
  relationshipDelta: RelationshipDelta
  memoryCandidates: MemoryCandidate[]
}
