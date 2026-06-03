import type { RelationshipDelta, RelationshipState } from '@amadeus/contracts'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'

import { join } from 'node:path'
import { RELATIONSHIP_STAGES } from '@amadeus/contracts'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  applyDelta,
  INITIAL_RELATIONSHIP,
  loadRelationship,
  narrativeStage,
  saveRelationship,
} from '../src/index.js'

const zeroDelta: RelationshipDelta = {
  trust: 0,
  affection: 0,
  familiarity: 0,
  annoyance: 0,
}

describe('iNITIAL_RELATIONSHIP', () => {
  it('is the documented seed for a brand-new user', () => {
    expect(INITIAL_RELATIONSHIP).toEqual({
      trust: 10,
      affection: 5,
      familiarity: 3,
      annoyance: 0,
      stage: 'stranger',
    })
  })

  it('has a stage that is internally consistent with narrativeStage', () => {
    expect(INITIAL_RELATIONSHIP.stage).toBe(narrativeStage(INITIAL_RELATIONSHIP))
  })
})

describe('narrativeStage', () => {
  it('is stranger at zero dimensions', () => {
    expect(
      narrativeStage({ trust: 0, affection: 0, familiarity: 0, annoyance: 0 }),
    ).toBe('stranger')
  })

  it('always returns a valid stage (total function)', () => {
    for (let t = 0; t <= 100; t += 25) {
      for (let f = 0; f <= 100; f += 25) {
        for (let a = 0; a <= 100; a += 25) {
          for (let n = 0; n <= 100; n += 50) {
            const stage = narrativeStage({
              trust: t,
              affection: a,
              familiarity: f,
              annoyance: n,
            })
            expect(RELATIONSHIP_STAGES).toContain(stage)
          }
        }
      }
    }
  })

  it('climbs as positive dimensions rise', () => {
    const low = narrativeStage({
      trust: 10,
      affection: 5,
      familiarity: 3,
      annoyance: 0,
    })
    const mid = narrativeStage({
      trust: 45,
      affection: 40,
      familiarity: 45,
      annoyance: 0,
    })
    const high = narrativeStage({
      trust: 90,
      affection: 90,
      familiarity: 90,
      annoyance: 0,
    })
    const lowIdx = RELATIONSHIP_STAGES.indexOf(low)
    const midIdx = RELATIONSHIP_STAGES.indexOf(mid)
    const highIdx = RELATIONSHIP_STAGES.indexOf(high)
    expect(lowIdx).toBeLessThan(midIdx)
    expect(midIdx).toBeLessThan(highIdx)
    expect(high).toBe('bonded')
  })

  it('is monotonic: raising any positive dimension never lowers the stage', () => {
    const base = { trust: 40, affection: 35, familiarity: 40, annoyance: 0 }
    const baseIdx = RELATIONSHIP_STAGES.indexOf(narrativeStage(base))
    const bumpTrust = RELATIONSHIP_STAGES.indexOf(
      narrativeStage({ ...base, trust: 80 }),
    )
    const bumpAff = RELATIONSHIP_STAGES.indexOf(
      narrativeStage({ ...base, affection: 80 }),
    )
    const bumpFam = RELATIONSHIP_STAGES.indexOf(
      narrativeStage({ ...base, familiarity: 80 }),
    )
    expect(bumpTrust).toBeGreaterThanOrEqual(baseIdx)
    expect(bumpAff).toBeGreaterThanOrEqual(baseIdx)
    expect(bumpFam).toBeGreaterThanOrEqual(baseIdx)
  })

  it('lets high annoyance hold the stage back', () => {
    const dims = { trust: 90, affection: 90, familiarity: 90, annoyance: 0 }
    const calm = narrativeStage(dims)
    const irritated = narrativeStage({ ...dims, annoyance: 95 })
    const calmIdx = RELATIONSHIP_STAGES.indexOf(calm)
    const irritatedIdx = RELATIONSHIP_STAGES.indexOf(irritated)
    expect(irritatedIdx).toBeLessThan(calmIdx)
  })

  it('annoyance is monotonic downward: more annoyance never raises the stage', () => {
    const dims = { trust: 70, affection: 70, familiarity: 70, annoyance: 0 }
    let prevIdx = RELATIONSHIP_STAGES.indexOf(narrativeStage(dims))
    for (const n of [20, 40, 60, 80, 100]) {
      const idx = RELATIONSHIP_STAGES.indexOf(
        narrativeStage({ ...dims, annoyance: n }),
      )
      expect(idx).toBeLessThanOrEqual(prevIdx)
      prevIdx = idx
    }
  })
})

describe('applyDelta', () => {
  it('adds the delta to the matching dimensions and recomputes stage', () => {
    const state: RelationshipState = {
      trust: 40,
      affection: 40,
      familiarity: 40,
      annoyance: 0,
      stage: narrativeStage({
        trust: 40,
        affection: 40,
        familiarity: 40,
        annoyance: 0,
      }),
    }
    const next = applyDelta(state, {
      trust: 5,
      affection: 3,
      familiarity: 2,
      annoyance: 1,
    })
    expect(next.trust).toBe(45)
    expect(next.affection).toBe(43)
    expect(next.familiarity).toBe(42)
    expect(next.annoyance).toBe(1)
    expect(next.stage).toBe(
      narrativeStage({
        trust: 45,
        affection: 43,
        familiarity: 42,
        annoyance: 1,
      }),
    )
  })

  it('never mutates the input state', () => {
    const state: RelationshipState = {
      trust: 50,
      affection: 50,
      familiarity: 50,
      annoyance: 0,
      stage: 'familiar',
    }
    const snapshot = { ...state }
    applyDelta(state, { trust: 10, affection: 10, familiarity: 10, annoyance: 10 })
    expect(state).toEqual(snapshot)
  })

  it('clamps an out-of-range delta into [-10,10] before applying', () => {
    const state: RelationshipState = {
      trust: 50,
      affection: 50,
      familiarity: 50,
      annoyance: 50,
      stage: 'familiar',
    }
    // Wildly out-of-range deltas (defensive against a misbehaving LLM)
    const next = applyDelta(state, {
      trust: 999,
      affection: -999,
      familiarity: 50,
      annoyance: -50,
    })
    // +999 clamps to +10 -> 60 ; -999 clamps to -10 -> 40 ;
    // +50 clamps to +10 -> 60 ; -50 clamps to -10 -> 40
    expect(next.trust).toBe(60)
    expect(next.affection).toBe(40)
    expect(next.familiarity).toBe(60)
    expect(next.annoyance).toBe(40)
  })

  it('clamps the resulting dimensions into [0,100]', () => {
    const high: RelationshipState = {
      trust: 98,
      affection: 2,
      familiarity: 100,
      annoyance: 1,
      stage: 'stranger',
    }
    const next = applyDelta(high, {
      trust: 10,
      affection: -10,
      familiarity: 10,
      annoyance: -10,
    })
    expect(next.trust).toBe(100)
    expect(next.affection).toBe(0)
    expect(next.familiarity).toBe(100)
    expect(next.annoyance).toBe(0)
  })

  it('returns a new object reference', () => {
    const state: RelationshipState = { ...INITIAL_RELATIONSHIP }
    const next = applyDelta(state, zeroDelta)
    expect(next).not.toBe(state)
  })
})

describe('relationship store round-trip', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'amadeus-rel-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('saves and reloads a state (round-trip)', () => {
    const filePath = join(dir, 'relationship.json')
    const state: RelationshipState = {
      trust: 72,
      affection: 64,
      familiarity: 70,
      annoyance: 4,
      stage: narrativeStage({
        trust: 72,
        affection: 64,
        familiarity: 70,
        annoyance: 4,
      }),
    }
    saveRelationship(filePath, state)
    const loaded = loadRelationship(filePath)
    expect(loaded).toEqual(state)
  })

  it('creates missing parent directories', () => {
    const filePath = join(dir, 'nested', 'deep', 'relationship.json')
    saveRelationship(filePath, INITIAL_RELATIONSHIP)
    const loaded = loadRelationship(filePath)
    expect(loaded).toEqual(INITIAL_RELATIONSHIP)
  })

  it('writes pretty-printed (2-space) JSON', () => {
    const filePath = join(dir, 'relationship.json')
    saveRelationship(filePath, INITIAL_RELATIONSHIP)
    const loaded = loadRelationship(filePath)
    expect(loaded).toEqual(INITIAL_RELATIONSHIP)
    // re-save and reload to ensure idempotency of formatting
    saveRelationship(filePath, loaded)
    expect(loadRelationship(filePath)).toEqual(INITIAL_RELATIONSHIP)
  })
})

describe('loadRelationship — never throws, safe defaults', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'amadeus-rel-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns INITIAL_RELATIONSHIP on a missing file', () => {
    const loaded = loadRelationship(join(dir, 'does-not-exist.json'))
    expect(loaded).toEqual(INITIAL_RELATIONSHIP)
  })

  it('returns a fresh clone (not the shared INITIAL_RELATIONSHIP reference)', () => {
    const loaded = loadRelationship(join(dir, 'does-not-exist.json'))
    expect(loaded).not.toBe(INITIAL_RELATIONSHIP)
  })

  it('returns INITIAL_RELATIONSHIP on malformed JSON', () => {
    const filePath = join(dir, 'broken.json')
    writeFileSync(filePath, '{ not valid json ', 'utf8')
    expect(loadRelationship(filePath)).toEqual(INITIAL_RELATIONSHIP)
  })

  it('returns INITIAL_RELATIONSHIP on a shape-invalid object', () => {
    const filePath = join(dir, 'wrongshape.json')
    writeFileSync(filePath, JSON.stringify({ hello: 'world' }), 'utf8')
    expect(loadRelationship(filePath)).toEqual(INITIAL_RELATIONSHIP)
  })

  it('returns INITIAL_RELATIONSHIP on a non-object root (array)', () => {
    const filePath = join(dir, 'array.json')
    writeFileSync(filePath, JSON.stringify([1, 2, 3]), 'utf8')
    expect(loadRelationship(filePath)).toEqual(INITIAL_RELATIONSHIP)
  })

  it('recomputes the stage defensively from loaded dims (hand-edited file)', () => {
    const filePath = join(dir, 'handedited.json')
    // dims that clearly imply a high stage, but stage field lies as 'stranger'
    const tampered = {
      trust: 95,
      affection: 95,
      familiarity: 95,
      annoyance: 0,
      stage: 'stranger',
    }
    writeFileSync(filePath, JSON.stringify(tampered), 'utf8')
    const loaded = loadRelationship(filePath)
    expect(loaded.trust).toBe(95)
    expect(loaded.affection).toBe(95)
    expect(loaded.familiarity).toBe(95)
    expect(loaded.annoyance).toBe(0)
    // stage corrected to what the dims actually imply
    expect(loaded.stage).toBe(
      narrativeStage({
        trust: 95,
        affection: 95,
        familiarity: 95,
        annoyance: 0,
      }),
    )
    expect(loaded.stage).not.toBe('stranger')
  })

  it('clamps out-of-range dims from a hand-edited file', () => {
    const filePath = join(dir, 'outofrange.json')
    const tampered = {
      trust: 500,
      affection: -20,
      familiarity: 50,
      annoyance: 999,
      stage: 'bonded',
    }
    writeFileSync(filePath, JSON.stringify(tampered), 'utf8')
    const loaded = loadRelationship(filePath)
    expect(loaded.trust).toBe(100)
    expect(loaded.affection).toBe(0)
    expect(loaded.familiarity).toBe(50)
    expect(loaded.annoyance).toBe(100)
  })
})
