import { MOODS } from '@amadeus/contracts'
import { describe, expect, it } from 'vitest'

import { ASCII_PORTRAIT_FRAMES, PORTRAIT_HEIGHT_LINES } from '../src/ui/portraits/ascii.js'

/** Visible width in code points — every portrait glyph is single-width. */
function width(line: string): number {
  return [...line].length
}

describe('ascii portrait frames', () => {
  it('covers every Mood', () => {
    for (const mood of MOODS) {
      expect(ASCII_PORTRAIT_FRAMES[mood], `missing frames for ${mood}`).toBeDefined()
    }
    expect(Object.keys(ASCII_PORTRAIT_FRAMES)).toHaveLength(MOODS.length)
  })

  it('ships exactly two frames (open + blink) per mood', () => {
    for (const mood of MOODS) {
      expect(ASCII_PORTRAIT_FRAMES[mood]).toHaveLength(2)
    }
  })

  // The renderer's expectedHeight + the layout's row reservation both assume a
  // fixed frame height; a frame with the wrong line count would shear the
  // phone layout. And ragged line widths break the centered-block look.
  it('every frame is exactly PORTRAIT_HEIGHT_LINES lines of uniform width', () => {
    for (const mood of MOODS) {
      for (const frame of ASCII_PORTRAIT_FRAMES[mood]) {
        const lines = frame.split('\n')
        expect(lines, `${mood} line count`).toHaveLength(PORTRAIT_HEIGHT_LINES)
        const widths = new Set(lines.map(width))
        expect(widths, `${mood} ragged widths: ${[...widths].join(',')}`).toHaveProperty('size', 1)
      }
    }
  })

  it('blinks: the blink frame differs from the open frame (closed eyes)', () => {
    for (const mood of MOODS) {
      const [open, blink] = ASCII_PORTRAIT_FRAMES[mood]
      expect(blink, `${mood} blink should differ`).not.toBe(open)
    }
  })
})
