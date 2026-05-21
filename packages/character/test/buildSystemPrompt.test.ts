import type { RelationshipState } from '@amadeus/contracts'

import { describe, expect, it } from 'vitest'

import { buildSystemPrompt } from '../src/buildSystemPrompt.js'
import { KURISU_BASE_PROMPT } from '../src/loadKurisuPrompt.js'

const baseState: RelationshipState = {
  trust: 10,
  affection: 5,
  familiarity: 3,
  annoyance: 0,
  stage: 'stranger',
}

describe('buildSystemPrompt', () => {
  it('includes the canonical Kurisu base prompt verbatim', () => {
    const prompt = buildSystemPrompt({ mode: 'companion', relationshipState: baseState })
    expect(prompt).toContain(KURISU_BASE_PROMPT.trim())
  })

  it('renders the companion mode section in companion mode', () => {
    const prompt = buildSystemPrompt({ mode: 'companion', relationshipState: baseState })
    expect(prompt).toContain('## Active mode: companion')
    expect(prompt).not.toContain('## Active mode: coding')
  })

  it('renders the coding mode section in coding mode', () => {
    const prompt = buildSystemPrompt({ mode: 'coding', relationshipState: baseState })
    expect(prompt).toContain('## Active mode: coding')
    expect(prompt).toContain('Code is the point')
  })

  it('produces different prompts for different modes', () => {
    const companion = buildSystemPrompt({ mode: 'companion', relationshipState: baseState })
    const coding = buildSystemPrompt({ mode: 'coding', relationshipState: baseState })
    expect(companion).not.toBe(coding)
  })

  it('renders the relationship section with current stage', () => {
    const prompt = buildSystemPrompt({
      mode: 'companion',
      relationshipState: { ...baseState, stage: 'bonded', trust: 95 },
    })
    expect(prompt).toContain('Stage: **bonded**')
    expect(prompt).toContain('Trust: 95/100')
  })

  it('omits the memory section entirely when no memories are provided', () => {
    const prompt = buildSystemPrompt({ mode: 'companion', relationshipState: baseState })
    expect(prompt).not.toContain('## What you remember about this user')
  })

  it('omits the memory section when memories array is empty', () => {
    const prompt = buildSystemPrompt({
      mode: 'companion',
      relationshipState: baseState,
      recentMemories: [],
    })
    expect(prompt).not.toContain('## What you remember about this user')
  })

  it('renders memories when provided, preserving order', () => {
    const prompt = buildSystemPrompt({
      mode: 'companion',
      relationshipState: baseState,
      recentMemories: [
        { type: 'preference', content: 'Dislikes instant coffee', importance: 6 },
        { type: 'project', content: 'Building a TUI companion called Amadeus', importance: 9 },
      ],
    })
    expect(prompt).toContain('## What you remember about this user')
    expect(prompt).toContain('[preference, importance 6] Dislikes instant coffee')
    expect(prompt).toContain('[project, importance 9] Building a TUI companion called Amadeus')
    const prefIdx = prompt.indexOf('Dislikes instant coffee')
    const projIdx = prompt.indexOf('Building a TUI companion')
    expect(prefIdx).toBeLessThan(projIdx)
  })

  it('returns a single trimmed string with no leading/trailing whitespace', () => {
    const prompt = buildSystemPrompt({ mode: 'companion', relationshipState: baseState })
    expect(prompt).toBe(prompt.trim())
  })
})
