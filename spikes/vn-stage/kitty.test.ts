import { Buffer } from 'node:buffer'
import { inflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'

import { chooseBackend, deleteImages, fitCells, placeholderLines, placeImage, transmitImage, wrapForTmux } from './kitty'

const ESC = '\x1B'
const PLACEHOLDER = '\u{10EEEE}'

describe('wrapForTmux', () => {
  it('wraps in a passthrough sequence and doubles every escape inside', () => {
    expect(wrapForTmux(`${ESC}_Ga=d;${ESC}\\`)).toBe(`${ESC}Ptmux;${ESC}${ESC}_Ga=d;${ESC}${ESC}\\${ESC}\\`)
  })
})

describe('transmitImage', () => {
  const bitmap = { width: 2, height: 1, data: new Uint8Array([1, 2, 3, 255, 4, 5, 6, 255]) }

  it('sends raw RGBA compressed, quietly, without displaying it', () => {
    const [first] = transmitImage(bitmap, 7)
    expect(first).toContain('a=t')
    expect(first).toContain('f=32')
    expect(first).toContain('s=2')
    expect(first).toContain('v=1')
    expect(first).toContain('o=z')
    expect(first).toContain('i=7')
    expect(first).toContain('q=2')
  })

  it('carries the pixels so they can be recovered from the payload', () => {
    const [first] = transmitImage(bitmap, 7)
    const payload = first!.slice(first!.indexOf(';') + 1, first!.lastIndexOf(`${ESC}\\`))
    expect([...inflateSync(Buffer.from(payload, 'base64'))]).toEqual([...bitmap.data])
  })

  it('splits long payloads, marking every chunk but the last with m=1', () => {
    const noisy = new Uint8Array(400 * 400 * 4).map((_, i) => (i * 2654435761) >>> 24)
    const chunks = transmitImage({ width: 400, height: 400, data: noisy }, 1)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks[0]).toContain('m=1')
    expect(chunks.at(-2)).toContain('m=1')
    expect(chunks.at(-1)).toContain('m=0')
    for (const chunk of chunks)
      expect(chunk.slice(chunk.indexOf(';') + 1).length).toBeLessThanOrEqual(4096 + 2)
  })
})

describe('placeImage', () => {
  it('creates one virtual placement of the size given', () => {
    const sequence = placeImage(7, 30, 20)
    for (const part of ['a=p', 'U=1', 'i=7', 'p=1', 'c=30', 'r=20', 'q=2'])
      expect(sequence).toContain(part)
  })
})

describe('deleteImages', () => {
  it('frees the range of ids, data included', () => {
    const sequence = deleteImages(10, 20)
    for (const part of ['a=d', 'd=R', 'x=10', 'y=20'])
      expect(sequence).toContain(part)
  })
})

describe('placeholderLines', () => {
  it('draws one placeholder per cell, colored with the image id', () => {
    const lines = placeholderLines(0x010203, 3, 2)
    expect(lines).toHaveLength(2)
    for (const line of lines) {
      expect(line).toContain(`${ESC}[38;2;1;2;3m`)
      expect([...line].filter(char => char === PLACEHOLDER)).toHaveLength(3)
    }
  })

  it('marks each row with its own diacritic, on the first cell', () => {
    const [top, bottom] = placeholderLines(1, 2, 2)
    expect(top).toContain(`${PLACEHOLDER}̅`)
    expect(bottom).toContain(`${PLACEHOLDER}̍`)
  })

  it('stops the color at the end of the line', () => {
    const [line] = placeholderLines(1, 1, 1)
    expect(line!.endsWith(`${ESC}[39m`)).toBe(true)
  })

  it('never asks for more rows than it has diacritics for', () => {
    expect(placeholderLines(1, 1, 500).length).toBeLessThan(500)
  })
})

describe('fitCells', () => {
  it('keeps the image proportions, given how tall a cell is', () => {
    expect(fitCells({ width: 100, height: 100 }, { width: 10, height: 20 }, 80, 80)).toEqual({ cols: 80, rows: 40 })
  })

  it('is limited by the rows when they run out first', () => {
    expect(fitCells({ width: 100, height: 200 }, { width: 10, height: 20 }, 80, 30)).toEqual({ cols: 30, rows: 30 })
  })

  it('never returns an empty size', () => {
    expect(fitCells({ width: 1000, height: 1 }, { width: 10, height: 20 }, 10, 10).rows).toBe(1)
  })
})

describe('chooseBackend', () => {
  it('honors an explicit choice over everything else', () => {
    expect(chooseBackend({ requested: 'halfblock', inTmux: false, termName: 'xterm-ghostty', passthrough: true })).toBe('halfblock')
    expect(chooseBackend({ requested: 'kitty', inTmux: false, termName: 'dumb', passthrough: false })).toBe('kitty')
  })

  it('uses kitty directly on terminals known to support placeholders', () => {
    expect(chooseBackend({ inTmux: false, termName: 'xterm-ghostty', passthrough: false })).toBe('kitty')
    expect(chooseBackend({ inTmux: false, termName: 'xterm-kitty', passthrough: false })).toBe('kitty')
  })

  it('needs passthrough inside tmux, and falls back to half-blocks without it', () => {
    expect(chooseBackend({ inTmux: true, termName: 'xterm-ghostty', passthrough: true })).toBe('kitty')
    expect(chooseBackend({ inTmux: true, termName: 'xterm-ghostty', passthrough: false })).toBe('halfblock')
  })

  it('falls back to half-blocks on any other terminal', () => {
    expect(chooseBackend({ inTmux: false, termName: 'xterm-256color', passthrough: false })).toBe('halfblock')
    expect(chooseBackend({ inTmux: true, termName: 'tmux-256color', passthrough: true })).toBe('halfblock')
  })

  it('ignores an unknown explicit choice', () => {
    expect(chooseBackend({ requested: 'sixel', inTmux: false, termName: 'xterm-256color', passthrough: false })).toBe('halfblock')
  })
})
