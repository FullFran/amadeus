import type { AmadeusState } from '@amadeus/contracts'

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createSoul } from '../src/agent/soul.js'

function turn(overrides: Partial<AmadeusState> = {}): AmadeusState {
  return {
    mood: 'neutral',
    relationshipDelta: { trust: 0, affection: 0, familiarity: 0, annoyance: 0 },
    memoryCandidates: [],
    ...overrides,
  }
}

describe('soul (integration: relationship + memory persistence)', () => {
  let dataDir: string

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'amadeus-soul-'))
  })

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true })
  })

  it('starts a brand-new user at stage stranger with no memories', () => {
    const soul = createSoul(dataDir)
    const rel = soul.relationship()
    expect(rel.stage).toBe('stranger')
    const prompt = soul.composePrompt('')
    expect(prompt).toContain('Stage: **stranger**')
    expect(prompt).not.toContain('What you remember about this user')
  })

  it('applies a relationship delta and PERSISTS it to relationship.json', () => {
    const soul = createSoul(dataDir)
    const next = soul.applyTurn(turn({
      relationshipDelta: { trust: 8, affection: 6, familiarity: 5, annoyance: 0 },
    }))

    // 0..100 dims grew from the seed (trust 10 -> 18, etc.)
    expect(next.trust).toBe(18)
    expect(next.affection).toBe(11)
    expect(soul.relationship().trust).toBe(18)

    const file = join(dataDir, 'relationship.json')
    expect(existsSync(file)).toBe(true)
    expect(JSON.parse(readFileSync(file, 'utf8')).trust).toBe(18)
  })

  it('retains an important memory and injects it into a relevant prompt', () => {
    const soul = createSoul(dataDir)
    soul.applyTurn(turn({
      memoryCandidates: [
        { type: 'preference', content: 'The user hates instant coffee', importance: 7 },
        { type: 'fact', content: 'irrelevant trivia', importance: 2 }, // below threshold, dropped
      ],
    }))

    const memFile = join(dataDir, 'memory.json')
    expect(existsSync(memFile)).toBe(true)
    const stored = JSON.parse(readFileSync(memFile, 'utf8'))
    expect(stored).toHaveLength(1)
    expect(stored[0].content).toBe('The user hates instant coffee')

    const prompt = soul.composePrompt('what coffee should I buy')
    expect(prompt).toContain('What you remember about this user')
    expect(prompt).toContain('The user hates instant coffee')
  })

  it('survives a process restart — a second soul over the same dir recalls state', () => {
    const first = createSoul(dataDir)
    first.applyTurn(turn({
      relationshipDelta: { trust: 10, affection: 10, familiarity: 10, annoyance: 0 },
      memoryCandidates: [{ type: 'project', content: 'Building a waifu in Rust', importance: 8 }],
    }))

    // A fresh soul (as if the app relaunched) loads from disk.
    const second = createSoul(dataDir)
    expect(second.relationship().trust).toBe(20)
    expect(second.composePrompt('how is the rust project')).toContain('Building a waifu in Rust')
  })
})
