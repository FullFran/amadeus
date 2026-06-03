import type { MemoryCandidate } from '@amadeus/contracts'
import type { StoredMemory } from '../src/store.js'

import { describe, expect, it } from 'vitest'
import { appendMemories } from '../src/append.js'

const now = new Date('2026-06-03T12:00:00.000Z')

describe('appendMemories', () => {
  it('converts a candidate into a StoredMemory with id and ISO createdAt', () => {
    const candidates: MemoryCandidate[] = [
      { type: 'preference', content: 'Hates instant coffee', importance: 6 },
    ]
    const result = appendMemories([], candidates, now)
    expect(result).toHaveLength(1)
    const m = result[0]!
    expect(m.type).toBe('preference')
    expect(m.content).toBe('Hates instant coffee')
    expect(m.importance).toBe(6)
    expect(m.createdAt).toBe('2026-06-03T12:00:00.000Z')
    expect(typeof m.id).toBe('string')
    expect(m.id.length).toBeGreaterThan(0)
  })

  it('assigns a unique id to each appended memory', () => {
    const candidates: MemoryCandidate[] = [
      { type: 'fact', content: 'a', importance: 7 },
      { type: 'fact', content: 'b', importance: 7 },
    ]
    const result = appendMemories([], candidates, now)
    expect(result[0]!.id).not.toBe(result[1]!.id)
  })

  it('appends to a NEW array and does not mutate the existing array', () => {
    const existing: StoredMemory[] = [
      { id: 'x', type: 'fact', content: 'keep', importance: 5, createdAt: '2025-01-01T00:00:00.000Z' },
    ]
    const existingCopy = [...existing]
    const result = appendMemories(existing, [{ type: 'goal', content: 'new', importance: 8 }], now)
    expect(result).not.toBe(existing)
    expect(existing).toEqual(existingCopy)
    expect(result).toHaveLength(2)
    expect(result[0]!.content).toBe('keep')
    expect(result[1]!.content).toBe('new')
  })

  it('dedupes a candidate whose normalized content already exists', () => {
    const existing: StoredMemory[] = [
      { id: 'x', type: 'fact', content: 'Likes Tea', importance: 5, createdAt: '2025-01-01T00:00:00.000Z' },
    ]
    const result = appendMemories(
      existing,
      [{ type: 'preference', content: '  likes tea  ', importance: 9 }],
      now,
    )
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe('x')
  })

  it('dedupes against earlier candidates added in the same call', () => {
    const result = appendMemories(
      [],
      [
        { type: 'fact', content: 'Same thing', importance: 7 },
        { type: 'preference', content: 'same THING', importance: 8 },
      ],
      now,
    )
    expect(result).toHaveLength(1)
    expect(result[0]!.content).toBe('Same thing')
  })

  it('uses the present instant when now is omitted', () => {
    const before = Date.now()
    const result = appendMemories([], [{ type: 'fact', content: 'x', importance: 7 }])
    const after = Date.now()
    const ts = Date.parse(result[0]!.createdAt)
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after)
  })
})
