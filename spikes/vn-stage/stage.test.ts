import { describe, expect, it } from 'vitest'

import { framesFromSheet, removeKeyHalo, renderHalfBlocks, scaleFrame } from './sheet'
import { createStage, FPS } from './stage'

const RED: [number, number, number, number] = [255, 0, 0, 255]
const BLUE: [number, number, number, number] = [0, 0, 255, 255]
const CLEAR: [number, number, number, number] = [0, 0, 0, 0]

/** A sheet of `rows` x 8 cells in the Codex proportions (12:13), painted by `paint(row, col)`. */
function sheet(rows: number, paint: (row: number, col: number) => typeof RED) {
  const cellW = 12
  const cellH = 13
  const width = 8 * cellW
  const height = rows * cellH
  const data = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++)
      data.set(paint(Math.floor(y / cellH), Math.floor(x / cellW)), (y * width + x) * 4)
  }
  return { width, height, data }
}

describe('framesFromSheet', () => {
  it('reads each row up to its last painted cell', () => {
    const frames = framesFromSheet(sheet(9, (row, col) => (row === 0 && col < 3 ? RED : row === 3 && col < 1 ? BLUE : CLEAR)))
    expect(frames.get(0)).toHaveLength(3)
    expect(frames.get(3)).toHaveLength(1)
    expect(frames.has(7)).toBe(false)
  })

  it('accepts version 1 and version 2 sheets, and rejects any other shape', () => {
    expect(() => framesFromSheet(sheet(9, () => RED))).not.toThrow()
    expect(() => framesFromSheet(sheet(11, () => RED))).not.toThrow()
    expect(() => framesFromSheet(sheet(10, () => RED))).toThrow(/rows/)
  })

  it('removes the key halo from the frames, and from the shared box', () => {
    const halo: typeof RED = [240, 0, 240, 128]
    const frames = framesFromSheet(sheet(9, (row, col) => (row === 0 && col === 0 ? RED : halo)))
    expect(frames.size).toBe(1)
    expect(frames.get(0)).toHaveLength(1)
  })

  it('crops every frame to one shared box, so the character does not jump between frames', () => {
    const frames = framesFromSheet(sheet(9, (row, col) => (row === 0 && col < 2 ? RED : CLEAR)))
    const [a, b] = frames.get(0)!
    expect([a.width, a.height]).toEqual([b.width, b.height])
  })
})

describe('removeKeyHalo', () => {
  const pixel = (r: number, g: number, b: number, a: number) => [...removeKeyHalo({ width: 1, height: 1, data: new Uint8Array([r, g, b, a]) }).data]

  it('clears partly transparent pixels of the key color, at any brightness', () => {
    expect(pixel(240, 0, 240, 128)).toEqual([0, 0, 0, 0])
    expect(pixel(48, 0, 48, 200)).toEqual([0, 0, 0, 0])
  })

  it('clears the key color hidden under full transparency, which scaling would bleed out', () => {
    expect(pixel(224, 0, 224, 0)).toEqual([0, 0, 0, 0])
  })

  it('keeps opaque magenta, which can be part of the art', () => {
    expect(pixel(240, 0, 240, 255)).toEqual([240, 0, 240, 255])
  })

  it('keeps partly transparent pixels of other colors', () => {
    expect(pixel(200, 40, 30, 128)).toEqual([200, 40, 30, 128])
    expect(pixel(0, 0, 0, 128)).toEqual([0, 0, 0, 128])
    expect(pixel(120, 90, 200, 128)).toEqual([120, 90, 200, 128])
  })

  describe('outline tinted by the key', () => {
    const TINT = [48, 0, 48, 255]
    const OPAQUE = [200, 200, 200, 255]
    const NONE = [0, 0, 0, 0]
    const clean = (width: number, height: number, pixels: number[][]) =>
      [...removeKeyHalo({ width, height, data: new Uint8Array(pixels.flat()) }).data]

    it('turns dark magenta black where it touches transparency', () => {
      expect(clean(2, 1, [TINT, NONE]).slice(0, 4)).toEqual([0, 0, 0, 255])
    })

    it('counts a neighbor above or below too', () => {
      expect(clean(1, 2, [TINT, NONE]).slice(0, 4)).toEqual([0, 0, 0, 255])
    })

    it('keeps dark magenta with no transparent neighbor, which is part of the art', () => {
      const pixels = [OPAQUE, OPAQUE, OPAQUE, OPAQUE, TINT, OPAQUE, OPAQUE, OPAQUE, OPAQUE]
      expect(clean(3, 3, pixels).slice(16, 20)).toEqual(TINT)
    })

    it('also counts a partly transparent neighbor', () => {
      expect(clean(2, 1, [TINT, [0, 0, 0, 128]]).slice(0, 4)).toEqual([0, 0, 0, 255])
    })

    it('keeps bright magenta on the edge', () => {
      expect(clean(2, 1, [[240, 0, 240, 255], NONE]).slice(0, 4)).toEqual([240, 0, 240, 255])
    })

    it('does not wrap around the end of a row to find a neighbor', () => {
      const pixels = [OPAQUE, TINT, NONE, OPAQUE]
      expect(clean(2, 2, pixels).slice(4, 8)).toEqual(TINT)
    })
  })

  it('does not change the sheet it receives', () => {
    const data = new Uint8Array([240, 0, 240, 128])
    removeKeyHalo({ width: 1, height: 1, data })
    expect([...data]).toEqual([240, 0, 240, 128])
  })
})

describe('scaleFrame', () => {
  it('fits the pixel box given, keeping the proportions', () => {
    const frame = { width: 100, height: 200, data: new Uint8Array(100 * 200 * 4).fill(255) }
    const scaled = scaleFrame(frame, 50, 25)
    expect(scaled.height).toBe(50)
    expect(scaled.width).toBe(25)
  })

  it('never scales above the size of the source', () => {
    const frame = { width: 4, height: 4, data: new Uint8Array(4 * 4 * 4).fill(255) }
    expect(scaleFrame(frame, 80, 80).width).toBe(4)
  })
})

describe('renderHalfBlocks', () => {
  const twoByTwo = (top: typeof RED, bottom: typeof RED) => ({
    width: 1,
    height: 2,
    data: new Uint8Array([...top, ...bottom]),
  })

  it('paints the top pixel as foreground and the bottom one as background', () => {
    const [line] = renderHalfBlocks(twoByTwo(RED, BLUE))
    expect(line).toContain('38;2;255;0;0')
    expect(line).toContain('48;2;0;0;255')
    expect(line).toContain('▀')
  })

  it('leaves a fully transparent cell as a plain space', () => {
    const [line] = renderHalfBlocks(twoByTwo(CLEAR, CLEAR))
    expect(line).toBe(' ')
  })

  it('uses the lower block when only the bottom pixel is painted', () => {
    const [line] = renderHalfBlocks(twoByTwo(CLEAR, BLUE))
    expect(line).toContain('▄')
    expect(line).toContain('38;2;0;0;255')
  })

  it('resets colors at the end of every painted line', () => {
    const [line] = renderHalfBlocks(twoByTwo(RED, RED))
    expect(line.endsWith('\x1B[0m')).toBe(true)
  })
})

describe('createStage', () => {
  const rows = new Set([0, 3, 4, 5, 6, 7, 8])

  it('rests on idle', () => {
    expect(createStage(rows).pose()).toBe('idle')
  })

  it('follows a turn: thinking, tool, speaking, then straight back to idle', () => {
    const stage = createStage(rows)
    stage.on('agent_start', 0)
    expect(stage.pose()).toBe('thinking')
    stage.on('tool_start', 10)
    expect(stage.pose()).toBe('tool')
    stage.on('tool_end', 20)
    expect(stage.pose()).toBe('thinking')
    stage.on('text_delta', 30)
    expect(stage.pose()).toBe('speaking')
    stage.on('agent_end', 40)
    expect(stage.pose()).toBe('idle')
  })

  it('still celebrates when forced by hand', () => {
    const stage = createStage(rows)
    stage.force('celebrating', 0)
    expect(stage.pose()).toBe('celebrating')
    stage.force(undefined, 10)
    expect(stage.pose()).toBe('idle')
  })

  it('shows a failed turn, and then rests', () => {
    const stage = createStage(rows)
    stage.on('agent_start', 0)
    stage.on('agent_error', 10)
    expect(stage.pose()).toBe('failed')
    stage.tick(10 + 3000)
    expect(stage.pose()).toBe('idle')
  })

  it('lets a tool interrupt speaking', () => {
    const stage = createStage(rows)
    stage.on('text_delta', 0)
    stage.on('tool_start', 1)
    expect(stage.pose()).toBe('tool')
  })

  it('plays the row of the pose at the speed of that row', () => {
    const stage = createStage(rows)
    stage.on('tool_start', 0)
    expect(stage.row()).toBe(7)
    expect(FPS[7]).toBe(8)
    expect(stage.frameIndex(4, 0)).toBe(0)
    expect(stage.frameIndex(4, 125)).toBe(1)
    expect(stage.frameIndex(4, 500)).toBe(0)
  })

  it('falls back to the idle row when the sheet lacks the row of the pose', () => {
    const stage = createStage(new Set([0, 7]))
    stage.on('agent_start', 0)
    expect(stage.pose()).toBe('thinking')
    expect(stage.row()).toBe(0)
  })

  it('restarts the animation when the pose changes', () => {
    const stage = createStage(rows)
    stage.on('tool_start', 1000)
    expect(stage.frameIndex(4, 1000)).toBe(0)
  })

  it('lets a forced pose win over agent events until it is released', () => {
    const stage = createStage(rows)
    stage.force('failed', 0)
    stage.on('agent_start', 1)
    expect(stage.pose()).toBe('failed')
    stage.force(undefined, 2)
    expect(stage.pose()).toBe('thinking')
  })
})
