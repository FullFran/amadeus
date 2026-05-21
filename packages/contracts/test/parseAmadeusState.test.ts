import { describe, expect, it } from 'vitest'

import { parseAmadeusState } from '../src/parseAmadeusState.js'

const validBlock = `
<amadeus_state>
{
  "mood": "smug",
  "relationshipDelta": { "trust": 1, "affection": 0, "familiarity": 1, "annoyance": 0 },
  "memoryCandidates": [
    { "type": "preference", "content": "El usuario odia el café instantáneo", "importance": 6 }
  ]
}
</amadeus_state>
`

describe('parseAmadeusState — happy path', () => {
  it('extracts a valid block into a typed AmadeusState', () => {
    const result = parseAmadeusState(validBlock)
    expect(result.ok).toBe(true)
    if (!result.ok)
      return
    expect(result.state.mood).toBe('smug')
    expect(result.state.relationshipDelta).toEqual({
      trust: 1,
      affection: 0,
      familiarity: 1,
      annoyance: 0,
    })
    expect(result.state.memoryCandidates).toHaveLength(1)
    expect(result.state.memoryCandidates[0]).toEqual({
      type: 'preference',
      content: 'El usuario odia el café instantáneo',
      importance: 6,
    })
  })

  it('tolerates surrounding natural-language text', () => {
    const text = `Sigh. ${validBlock} (irrelevant trailing notes)`
    const result = parseAmadeusState(text)
    expect(result.ok).toBe(true)
  })

  it('accepts an empty memoryCandidates array', () => {
    const text = `<amadeus_state>{"mood":"neutral","relationshipDelta":{"trust":0,"affection":0,"familiarity":0,"annoyance":0},"memoryCandidates":[]}</amadeus_state>`
    const result = parseAmadeusState(text)
    expect(result.ok).toBe(true)
    if (!result.ok)
      return
    expect(result.state.memoryCandidates).toEqual([])
  })
})

describe('parseAmadeusState — missing block', () => {
  it('returns missing-block when no tags are present', () => {
    const result = parseAmadeusState('Just chatting, no state here.')
    expect(result).toEqual({ ok: false, error: { kind: 'missing-block' } })
  })

  it('returns missing-block for empty input', () => {
    const result = parseAmadeusState('')
    expect(result).toEqual({ ok: false, error: { kind: 'missing-block' } })
  })
})

describe('parseAmadeusState — invalid JSON', () => {
  it('returns invalid-json with a message on malformed JSON', () => {
    const result = parseAmadeusState('<amadeus_state>{ not json }</amadeus_state>')
    expect(result.ok).toBe(false)
    if (result.ok)
      return
    expect(result.error.kind).toBe('invalid-json')
    if (result.error.kind !== 'invalid-json')
      return
    expect(result.error.message.length).toBeGreaterThan(0)
  })
})

describe('parseAmadeusState — invalid shape', () => {
  it('flags an unknown mood', () => {
    const text = `<amadeus_state>{"mood":"existential","relationshipDelta":{"trust":0,"affection":0,"familiarity":0,"annoyance":0},"memoryCandidates":[]}</amadeus_state>`
    const result = parseAmadeusState(text)
    expect(result.ok).toBe(false)
    if (result.ok)
      return
    expect(result.error).toMatchObject({ kind: 'invalid-shape', field: 'mood' })
  })

  it('flags a missing delta field', () => {
    const text = `<amadeus_state>{"mood":"neutral","relationshipDelta":{"trust":0,"affection":0,"familiarity":0},"memoryCandidates":[]}</amadeus_state>`
    const result = parseAmadeusState(text)
    expect(result.ok).toBe(false)
    if (result.ok)
      return
    expect(result.error).toMatchObject({
      kind: 'invalid-shape',
      field: 'relationshipDelta.annoyance',
    })
  })

  it('flags a non-numeric delta field', () => {
    const text = `<amadeus_state>{"mood":"neutral","relationshipDelta":{"trust":"high","affection":0,"familiarity":0,"annoyance":0},"memoryCandidates":[]}</amadeus_state>`
    const result = parseAmadeusState(text)
    expect(result.ok).toBe(false)
    if (result.ok)
      return
    expect(result.error).toMatchObject({
      kind: 'invalid-shape',
      field: 'relationshipDelta.trust',
    })
  })

  it('flags an invalid memory candidate type', () => {
    const text = `<amadeus_state>{"mood":"neutral","relationshipDelta":{"trust":0,"affection":0,"familiarity":0,"annoyance":0},"memoryCandidates":[{"type":"weather","content":"It rained","importance":3}]}</amadeus_state>`
    const result = parseAmadeusState(text)
    expect(result.ok).toBe(false)
    if (result.ok)
      return
    expect(result.error).toMatchObject({
      kind: 'invalid-shape',
      field: 'memoryCandidates[0].type',
    })
  })

  it('flags an empty memory candidate content', () => {
    const text = `<amadeus_state>{"mood":"neutral","relationshipDelta":{"trust":0,"affection":0,"familiarity":0,"annoyance":0},"memoryCandidates":[{"type":"fact","content":"","importance":3}]}</amadeus_state>`
    const result = parseAmadeusState(text)
    expect(result.ok).toBe(false)
    if (result.ok)
      return
    expect(result.error).toMatchObject({
      kind: 'invalid-shape',
      field: 'memoryCandidates[0].content',
    })
  })

  it('flags memoryCandidates that is not an array', () => {
    const text = `<amadeus_state>{"mood":"neutral","relationshipDelta":{"trust":0,"affection":0,"familiarity":0,"annoyance":0},"memoryCandidates":"none"}</amadeus_state>`
    const result = parseAmadeusState(text)
    expect(result.ok).toBe(false)
    if (result.ok)
      return
    expect(result.error).toMatchObject({
      kind: 'invalid-shape',
      field: 'memoryCandidates',
    })
  })

  it('flags non-object root', () => {
    const text = `<amadeus_state>"not an object"</amadeus_state>`
    const result = parseAmadeusState(text)
    expect(result.ok).toBe(false)
    if (result.ok)
      return
    expect(result.error).toMatchObject({ kind: 'invalid-shape', field: 'root' })
  })
})
