/** Codex pet sheets: eight columns, 9 (v1) or 11 (v2) rows, cells of 192x208. */
export interface Bitmap {
  width: number
  height: number
  /** RGBA, 8 bits per channel. */
  data: Uint8Array
}

const COLUMNS = 8
const CELL_RATIO = 208 / 192
const PAINTED_ALPHA = 16
const VISIBLE_ALPHA = 128
const KEY_MAX_GREEN = 16
const KEY_MIN_LEVEL = 16
const KEY_MAX_SKEW = 24
const OUTLINE_MAX_LEVEL = 96

function isKeyColor(data: Uint8Array, i: number): boolean {
  const r = data[i]!
  return data[i + 1]! <= KEY_MAX_GREEN && r >= KEY_MIN_LEVEL && Math.abs(r - data[i + 2]!) <= KEY_MAX_SKEW
}

/**
 * Some generated sheets keep a halo of the magenta they were keyed from, even
 * under fully transparent pixels, and an outline tinted by it. The halo goes
 * and the outline turns black. Other opaque magenta stays: it can be in the art.
 */
export function removeKeyHalo(sheet: Bitmap): Bitmap {
  const { width, height } = sheet
  const data = new Uint8Array(sheet.data)
  const touchesTransparency = (x: number, y: number) =>
    (x > 0 && data[(y * width + x - 1) * 4 + 3] !== 255)
    || (x < width - 1 && data[(y * width + x + 1) * 4 + 3] !== 255)
    || (y > 0 && data[((y - 1) * width + x) * 4 + 3] !== 255)
    || (y < height - 1 && data[((y + 1) * width + x) * 4 + 3] !== 255)

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3]! < 255 && isKeyColor(data, i))
      data.fill(0, i, i + 4)
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (data[i + 3] === 255 && data[i]! <= OUTLINE_MAX_LEVEL && isKeyColor(data, i) && touchesTransparency(x, y))
        data.fill(0, i, i + 3)
    }
  }
  return { ...sheet, data }
}

function isCellPainted(sheet: Bitmap, left: number, top: number, cellW: number, cellH: number): boolean {
  for (let y = top; y < top + cellH; y++) {
    for (let x = left; x < left + cellW; x++) {
      if (sheet.data[(y * sheet.width + x) * 4 + 3]! >= PAINTED_ALPHA)
        return true
    }
  }
  return false
}

function crop(sheet: Bitmap, left: number, top: number, width: number, height: number): Bitmap {
  const data = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    const start = ((top + y) * sheet.width + left) * 4
    data.set(sheet.data.subarray(start, start + width * 4), y * width * 4)
  }
  return { width, height, data }
}

/**
 * Splits a sheet into its frames by row. Every frame is cropped to one box
 * shared by the whole sheet, so the character keeps its place between frames
 * and fills the column instead of the sheet's padding.
 */
export function framesFromSheet(source: Bitmap): Map<number, Bitmap[]> {
  const sheet = removeKeyHalo(source)
  const cellW = sheet.width / COLUMNS
  const rows = Math.round(sheet.height / (cellW * CELL_RATIO))
  if (rows !== 9 && rows !== 11)
    throw new Error(`expected a sheet of 9 or 11 rows, got ${rows} rows from ${sheet.width}x${sheet.height}`)
  const cellH = sheet.height / rows

  const box = { left: cellW, top: cellH, right: 0, bottom: 0 }
  const lengths = new Map<number, number>()
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < COLUMNS; col++) {
      const left = col * cellW
      const top = row * cellH
      if (!isCellPainted(sheet, left, top, cellW, cellH))
        continue
      lengths.set(row, col + 1)
      for (let y = 0; y < cellH; y++) {
        for (let x = 0; x < cellW; x++) {
          if (sheet.data[((top + y) * sheet.width + left + x) * 4 + 3]! < PAINTED_ALPHA)
            continue
          box.left = Math.min(box.left, x)
          box.top = Math.min(box.top, y)
          box.right = Math.max(box.right, x + 1)
          box.bottom = Math.max(box.bottom, y + 1)
        }
      }
    }
  }

  const frames = new Map<number, Bitmap[]>()
  for (const [row, length] of lengths) {
    const list: Bitmap[] = []
    for (let col = 0; col < length; col++)
      list.push(crop(sheet, col * cellW + box.left, row * cellH + box.top, box.right - box.left, box.bottom - box.top))
    frames.set(row, list)
  }
  return frames
}

/** Fits a frame in a box of pixels by averaging, without ever enlarging it. */
export function scaleFrame(frame: Bitmap, maxHeight: number, maxWidth: number): Bitmap {
  const scale = Math.min(1, maxWidth / frame.width, maxHeight / frame.height)
  const width = Math.max(1, Math.round(frame.width * scale))
  const height = Math.max(1, Math.round(frame.height * scale))
  if (width === frame.width && height === frame.height)
    return frame

  const data = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    const fromY = Math.floor(y * frame.height / height)
    const toY = Math.max(fromY + 1, Math.floor((y + 1) * frame.height / height))
    for (let x = 0; x < width; x++) {
      const fromX = Math.floor(x * frame.width / width)
      const toX = Math.max(fromX + 1, Math.floor((x + 1) * frame.width / width))
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let sy = fromY; sy < toY; sy++) {
        for (let sx = fromX; sx < toX; sx++) {
          const i = (sy * frame.width + sx) * 4
          const alpha = frame.data[i + 3]!
          r += frame.data[i]! * alpha
          g += frame.data[i + 1]! * alpha
          b += frame.data[i + 2]! * alpha
          a += alpha
        }
      }
      const out = (y * width + x) * 4
      if (a > 0) {
        data[out] = r / a
        data[out + 1] = g / a
        data[out + 2] = b / a
        data[out + 3] = a / ((toY - fromY) * (toX - fromX))
      }
    }
  }
  return { width, height, data }
}

function color(frame: Bitmap, x: number, y: number): string | undefined {
  if (y >= frame.height)
    return undefined
  const i = (y * frame.width + x) * 4
  if (frame.data[i + 3]! < VISIBLE_ALPHA)
    return undefined
  return `${frame.data[i]};${frame.data[i + 1]};${frame.data[i + 2]}`
}

const RESET = '\x1B[0m'

/** Two pixels per cell, one over the other. Transparent pixels show the terminal's background. */
export function renderHalfBlocks(frame: Bitmap): string[] {
  const lines: string[] = []
  for (let y = 0; y < frame.height; y += 2) {
    let line = ''
    let active = ''
    for (let x = 0; x < frame.width; x++) {
      const top = color(frame, x, y)
      const bottom = color(frame, x, y + 1)
      let style = ''
      let glyph = ' '
      if (top && bottom) {
        style = `\x1B[38;2;${top};48;2;${bottom}m`
        glyph = '▀'
      }
      else if (top) {
        style = `\x1B[38;2;${top}m`
        glyph = '▀'
      }
      else if (bottom) {
        style = `\x1B[38;2;${bottom}m`
        glyph = '▄'
      }
      if (style !== active) {
        line += (active ? RESET : '') + style
        active = style
      }
      line += glyph
    }
    lines.push(active ? line + RESET : line)
  }
  return lines
}
