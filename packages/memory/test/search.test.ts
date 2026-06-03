import type { StoredMemory } from '../src/store.js'

import { describe, expect, it } from 'vitest'
import { searchMemory } from '../src/search.js'

const relevantRecentHigh: StoredMemory = {
  id: 'a',
  type: 'preference',
  content: 'The user loves dark roast coffee in the morning',
  importance: 9,
  createdAt: '2026-06-01T00:00:00.000Z',
}

const irrelevantOldLow: StoredMemory = {
  id: 'b',
  type: 'fact',
  content: 'The capital of France is Paris',
  importance: 1,
  createdAt: '2020-01-01T00:00:00.000Z',
}

const memories: StoredMemory[] = [irrelevantOldLow, relevantRecentHigh]

describe('searchMemory', () => {
  it('ranks a relevant, high-importance, recent memory above an irrelevant old low one', () => {
    const result = searchMemory(memories, 'coffee')
    expect(result[0]!.id).toBe('a')
  })

  it('respects k', () => {
    const result = searchMemory(memories, 'coffee', 1)
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe('a')
  })

  it('defaults to top 5', () => {
    const many: StoredMemory[] = Array.from({ length: 8 }, (_, i) => ({
      id: String(i),
      type: 'fact',
      content: `item ${i}`,
      importance: i,
      createdAt: '2026-01-01T00:00:00.000Z',
    }))
    expect(searchMemory(many, 'item')).toHaveLength(5)
  })

  it('falls back to importance + recency when the query is empty', () => {
    const result = searchMemory(memories, '')
    // relevantRecentHigh is both more important and more recent
    expect(result[0]!.id).toBe('a')
  })

  it('does not mutate the input array', () => {
    const copy = [...memories]
    searchMemory(memories, 'coffee')
    expect(memories).toEqual(copy)
  })

  it('returns matches case-insensitively', () => {
    const result = searchMemory(memories, 'COFFEE')
    expect(result[0]!.id).toBe('a')
  })
})
