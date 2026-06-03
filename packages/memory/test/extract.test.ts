import type { MemoryCandidate } from '@amadeus/contracts'
import { describe, expect, it } from 'vitest'

import { extractMemoryCandidates } from '../src/extract.js'

const candidates: MemoryCandidate[] = [
  { type: 'fact', content: 'low', importance: 2 },
  { type: 'preference', content: 'mid', importance: 5 },
  { type: 'goal', content: 'high', importance: 9 },
]

describe('extractMemoryCandidates', () => {
  it('keeps candidates at or above the default threshold of 5, preserving order', () => {
    const result = extractMemoryCandidates(candidates)
    expect(result.map(c => c.content)).toEqual(['mid', 'high'])
  })

  it('respects a custom threshold', () => {
    const result = extractMemoryCandidates(candidates, 9)
    expect(result.map(c => c.content)).toEqual(['high'])
  })

  it('returns an empty array when nothing meets the threshold', () => {
    expect(extractMemoryCandidates(candidates, 11)).toEqual([])
  })

  it('does not mutate the input array', () => {
    const copy = [...candidates]
    extractMemoryCandidates(candidates)
    expect(candidates).toEqual(copy)
  })
})
