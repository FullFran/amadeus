import type { MemoryCandidate } from '@amadeus/contracts'

/** Default importance threshold for keeping a candidate. */
export const DEFAULT_IMPORTANCE_THRESHOLD = 5

/**
 * Filter candidates down to those worth persisting: any whose `importance` is
 * at or above `threshold`. Order is preserved and the input is not mutated.
 */
export function extractMemoryCandidates(
  candidates: readonly MemoryCandidate[],
  threshold: number = DEFAULT_IMPORTANCE_THRESHOLD,
): MemoryCandidate[] {
  return candidates.filter(c => c.importance >= threshold)
}
