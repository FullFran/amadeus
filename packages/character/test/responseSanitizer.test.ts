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

  it('hides an unclosed (streaming) block so raw JSON never leaks on screen', () => {
    const text = `Working on it...<amadeus_state>{"mood":"thinking"`
    expect(sanitizeResponse(text)).toBe('Working on it...')
  })

  it('hides an unclosed block that is still inside an opening code fence', () => {
    const text = `Mi nombre es Kurisu.\n\n\`\`\`xml\n<amadeus_state>\n{"mood":"neu`
    expect(sanitizeResponse(text)).toBe('Mi nombre es Kurisu.')
  })

  it('hides the marker the moment the opening tag finishes streaming', () => {
    const text = `Listo, baka.\n\n<amadeus_state>`
    expect(sanitizeResponse(text)).toBe('Listo, baka.')
  })

  it('does not strip a stray angle bracket in visible prose', () => {
    expect(sanitizeResponse('if a < b then ship it')).toBe('if a < b then ship it')
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

  it('strips a leading <mood> tag and its trailing whitespace', () => {
    expect(sanitizeResponse('<mood>smug</mood>\n\nReasonable position.')).toBe('Reasonable position.')
  })

  it('hides a leading <mood> tag while its value is still streaming', () => {
    expect(sanitizeResponse('<mood>thinki')).toBe('')
    expect(sanitizeResponse('<mood>')).toBe('')
  })

  it('hides the leading mood opening tag arriving char-by-char', () => {
    expect(sanitizeResponse('<m')).toBe('')
    expect(sanitizeResponse('<mood')).toBe('')
  })

  it('strips BOTH the leading mood tag and the trailing state block', () => {
    const text = '<mood>soft</mood>\nHola.\n\n<amadeus_state>{"mood":"soft"}</amadeus_state>'
    expect(sanitizeResponse(text)).toBe('Hola.')
  })

  it('leaves a non-leading "<" in prose alone', () => {
    expect(sanitizeResponse('use a < b to compare')).toBe('use a < b to compare')
  })
})
