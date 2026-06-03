import type { StoredMemory } from './store.js'

/** Default number of results to return from {@link searchMemory}. */
export const DEFAULT_SEARCH_K = 5

const IMPORTANCE_WEIGHT = 0.3
const RECENCY_WEIGHT = 0.2
const RELEVANCE_WEIGHT = 0.5

/** Split a string into lowercase alphanumeric tokens. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter(t => t.length > 0)
}

/**
 * Naive lexical relevance in [0, 1]: the fraction of query tokens that appear
 * (as a token or substring) in the memory content. Case-insensitive.
 */
function relevanceScore(content: string, queryTokens: readonly string[]): number {
  if (queryTokens.length === 0)
    return 0
  const haystack = content.toLowerCase()
  const contentTokens = new Set(tokenize(content))
  let hits = 0
  for (const token of queryTokens) {
    if (contentTokens.has(token) || haystack.includes(token))
      hits += 1
  }
  return hits / queryTokens.length
}

/**
 * Rank `memories` against `query` and return the top `k`. The input array is
 * not mutated.
 *
 * Scoring formula (each component normalized to [0, 1]):
 *   score = 0.5*relevance + 0.3*importance + 0.2*recency   (non-empty query)
 *   score =                 0.3*importance + 0.2*recency    (empty query)
 *
 * - relevance: fraction of query tokens found in content (token or substring).
 * - importance: `importance / 10` (the 0..10 contract scale).
 * - recency: linear over the createdAt range of the candidate set — the most
 *   recent memory scores 1, the oldest 0; ties / single-item sets score 1.
 *
 * No embeddings, no external dependencies.
 */
export function searchMemory(
  memories: readonly StoredMemory[],
  query: string,
  k: number = DEFAULT_SEARCH_K,
): StoredMemory[] {
  if (memories.length === 0)
    return []

  const queryTokens = tokenize(query)
  const hasQuery = queryTokens.length > 0

  const times = memories.map(m => Date.parse(m.createdAt)).map(t => (Number.isFinite(t) ? t : 0))
  const minTime = Math.min(...times)
  const maxTime = Math.max(...times)
  const span = maxTime - minTime

  const scored = memories.map((memory, i) => {
    const importance = Math.max(0, Math.min(1, memory.importance / 10))
    const recency = span === 0 ? 1 : (times[i]! - minTime) / span
    const relevance = hasQuery ? relevanceScore(memory.content, queryTokens) : 0

    const score = hasQuery
      ? RELEVANCE_WEIGHT * relevance + IMPORTANCE_WEIGHT * importance + RECENCY_WEIGHT * recency
      : IMPORTANCE_WEIGHT * importance + RECENCY_WEIGHT * recency

    return { memory, score }
  })

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(s => s.memory)
}
