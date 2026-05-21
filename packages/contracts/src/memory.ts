export const MEMORY_TYPES = [
  'fact',
  'preference',
  'project',
  'event',
  'goal',
  'boundary',
  'relationship',
] as const

export type MemoryType = typeof MEMORY_TYPES[number]

export function isMemoryType(value: unknown): value is MemoryType {
  return typeof value === 'string' && (MEMORY_TYPES as readonly string[]).includes(value)
}

/**
 * A candidate memory proposed by the assistant in a single turn. The
 * persistence layer decides which candidates to keep based on
 * {@link MemoryCandidate.importance} and any user-configured policy.
 */
export interface MemoryCandidate {
  type: MemoryType
  /** Human-readable content. Must be non-empty. */
  content: string
  /** Suggested importance on a 0..10 scale. */
  importance: number
}
