import type { StoredMemory } from '../src/store.js'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadMemories, saveMemories } from '../src/store.js'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'amadeus-memory-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

const sample: StoredMemory[] = [
  { id: '1', type: 'fact', content: 'one', importance: 5, createdAt: '2026-01-01T00:00:00.000Z' },
  { id: '2', type: 'goal', content: 'two', importance: 8, createdAt: '2026-02-01T00:00:00.000Z' },
]

describe('loadMemories — safe defaults (never throws)', () => {
  it('returns [] when the file does not exist', () => {
    expect(loadMemories(join(dir, 'missing.json'))).toEqual([])
  })

  it('returns [] on malformed JSON', () => {
    const p = join(dir, 'bad.json')
    writeFileSync(p, '{ not valid json', 'utf8')
    expect(loadMemories(p)).toEqual([])
  })

  it('returns [] when the JSON is not an array', () => {
    const p = join(dir, 'obj.json')
    writeFileSync(p, '{"foo":"bar"}', 'utf8')
    expect(loadMemories(p)).toEqual([])
  })

  it('filters out shape-invalid entries defensively', () => {
    const p = join(dir, 'mixed.json')
    writeFileSync(
      p,
      JSON.stringify([
        sample[0],
        { id: 'x', type: 'not-a-type', content: 'bad', importance: 5, createdAt: 'z' },
        { id: 'y', content: 'missing type', importance: 5, createdAt: 'z' },
        { id: 'z', type: 'fact', content: '', importance: 5, createdAt: 'z' },
        { id: 'w', type: 'fact', content: 'no importance', createdAt: 'z' },
        'totally wrong',
        sample[1],
      ]),
      'utf8',
    )
    const result = loadMemories(p)
    expect(result).toEqual(sample)
  })
})

describe('store round-trip', () => {
  it('saves then loads identical memories', () => {
    const p = join(dir, 'mem.json')
    saveMemories(p, sample)
    expect(loadMemories(p)).toEqual(sample)
  })

  it('creates parent directories that do not exist', () => {
    const p = join(dir, 'nested', 'deep', 'mem.json')
    saveMemories(p, sample)
    expect(loadMemories(p)).toEqual(sample)
  })

  it('writes pretty 2-space JSON', () => {
    const p = join(dir, 'pretty.json')
    saveMemories(p, sample)
    const loaded = loadMemories(p)
    expect(loaded).toEqual(sample)
  })
})
