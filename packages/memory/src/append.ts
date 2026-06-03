import type { MemoryCandidate } from '@amadeus/contracts'

import type { StoredMemory } from './store.js'

import { randomUUID } from 'node:crypto'

/** Normalize content for dedupe comparison: trim + lowercase. */
function normalize(content: string): string {
  return content.trim().toLowerCase()
}

/**
 * Append candidates to `existing`, returning a NEW array (the input is never
 * mutated). Each kept candidate becomes a {@link StoredMemory} with a fresh
 * `randomUUID` id and a `createdAt` ISO string.
 *
 * `createdAt` uses `now` when provided (which is what keeps tests
 * deterministic); otherwise it captures the present instant via the
 * zero-argument `Date` constructor.
 *
 * Dedupe: a candidate is skipped when its normalized content (trim +
 * lowercase) already exists — either in `existing` or among earlier candidates
 * accepted in the same call.
 */
export function appendMemories(
  existing: readonly StoredMemory[],
  candidates: readonly MemoryCandidate[],
  now?: Date,
): StoredMemory[] {
  const result: StoredMemory[] = [...existing]
  const seen = new Set(existing.map(m => normalize(m.content)))

  for (const candidate of candidates) {
    const key = normalize(candidate.content)
    if (seen.has(key))
      continue
    seen.add(key)

    const createdAt = (now ?? new Date()).toISOString()
    result.push({
      id: randomUUID(),
      type: candidate.type,
      content: candidate.content,
      importance: candidate.importance,
      createdAt,
    })
  }

  return result
}
