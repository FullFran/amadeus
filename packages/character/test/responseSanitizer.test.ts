import { describe, expect, it } from 'vitest'

import { sanitizeResponse } from '../src/responseSanitizer.js'

describe('sanitizeResponse', () => {
  it('returns text unchanged when there is no state block', () => {
    expect(sanitizeResponse('Hello there.')).toBe('Hello there.')
  })

  it('returns an empty string for empty input', () => {
    expect(sanitizeResponse('')).toBe('')
  })

  it('strips a single trailing state block', () => {
    const text = `Reasonable position.

<amadeus_state>
{"mood":"smug","relationshipDelta":{"trust":0,"affection":0,"familiarity":1,"annoyance":0},"memoryCandidates":[]}
</amadeus_state>`
    expect(sanitizeResponse(text)).toBe('Reasonable position.')
  })

  it('strips a state block that appears mid-text', () => {
    const text = `before<amadeus_state>{"mood":"neutral"}</amadeus_state>after`
    expect(sanitizeResponse(text)).toBe('beforeafter')
  })

  it('strips multiple state blocks', () => {
    const text = `One.<amadeus_state>{"a":1}</amadeus_state> Two.<amadeus_state>{"b":2}</amadeus_state>`
    expect(sanitizeResponse(text)).toBe('One. Two.')
  })

  it('returns empty string when the input is only a state block', () => {
    const text = `<amadeus_state>{"mood":"neutral"}</amadeus_state>`
    expect(sanitizeResponse(text)).toBe('')
  })

  it('collapses excessive blank lines left behind by stripping', () => {
    const text = `Line one.

<amadeus_state>{"mood":"neutral"}</amadeus_state>

Line two.`
    const out = sanitizeResponse(text)
    expect(out).toBe('Line one.\n\n\nLine two.'.replace(/\n{3,}/g, '\n\n'))
    expect(out).not.toMatch(/\n{3,}/)
  })

  it('leaves an unclosed (streaming) block intact', () => {
    const text = `Working on it...<amadeus_state>{"mood":"thinking"`
    expect(sanitizeResponse(text)).toBe(text.trimEnd())
  })

  it('strips a state block wrapped in a markdown code fence', () => {
    const text = `Mi nombre es Kurisu.

\`\`\`xml
<amadeus_state>
{"mood":"neutral"}
</amadeus_state>
\`\`\``
    expect(sanitizeResponse(text)).toBe('Mi nombre es Kurisu.')
  })

  it('strips a state block wrapped in a bare code fence', () => {
    const text = `Hola.\n\n\`\`\`\n<amadeus_state>{"mood":"smug"}</amadeus_state>\n\`\`\``
    expect(sanitizeResponse(text)).toBe('Hola.')
  })

  it('strips a fenced block even with blank lines between the fence and the tag', () => {
    const text = `Mi nombre es Kurisu.\n\n\`\`\`xml\n\n<amadeus_state>\n{"mood":"neutral"}\n</amadeus_state>\n\n\`\`\``
    expect(sanitizeResponse(text)).toBe('Mi nombre es Kurisu.')
  })
})
