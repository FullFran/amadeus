import type { RelationshipState } from '@amadeus/contracts'

import { describe, expect, it } from 'vitest'

import { resolveMood } from '../src/moodRules.js'

const calmState: RelationshipState = {
  trust: 50,
  affection: 30,
  familiarity: 20,
  annoyance: 10,
  stage: 'acquainted',
}

const irritatedState: RelationshipState = {
  ...calmState,
  annoyance: 80,
}

describe('resolveMood', () => {
  it('returns the LLM mood unchanged when annoyance is low', () => {
    expect(resolveMood({ llmMood: 'smug', state: calmState })).toBe('smug')
    expect(resolveMood({ llmMood: 'neutral', state: calmState })).toBe('neutral')
    expect(resolveMood({ llmMood: 'soft', state: calmState })).toBe('soft')
  })

  it('overrides a non-congruent mood to annoyed when annoyance is high', () => {
    expect(resolveMood({ llmMood: 'neutral', state: irritatedState })).toBe('annoyed')
    expect(resolveMood({ llmMood: 'soft', state: irritatedState })).toBe('annoyed')
    expect(resolveMood({ llmMood: 'smug', state: irritatedState })).toBe('annoyed')
  })

  it('leaves congruent moods (annoyed, serious) unchanged when annoyance is high', () => {
    expect(resolveMood({ llmMood: 'annoyed', state: irritatedState })).toBe('annoyed')
    expect(resolveMood({ llmMood: 'serious', state: irritatedState })).toBe('serious')
  })

  it('does not override at exactly the threshold boundary minus one', () => {
    const justBelow: RelationshipState = { ...calmState, annoyance: 69 }
    expect(resolveMood({ llmMood: 'neutral', state: justBelow })).toBe('neutral')
  })

  it('overrides at exactly the threshold', () => {
    const atThreshold: RelationshipState = { ...calmState, annoyance: 70 }
    expect(resolveMood({ llmMood: 'neutral', state: atThreshold })).toBe('annoyed')
  })
})
