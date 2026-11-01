import type { Bitmap } from './sheet'

import { deflateSync } from 'node:zlib'

/**
 * Kitty graphics through Unicode placeholders. An image is uploaded once, and
 * the screen only holds ordinary text cells whose color names the image, so
 * tmux and Pi's renderer treat them like any other text.
 */

const ESC = '\x1B'
const PLACEHOLDER = '\u{10EEEE}'
const CHUNK_SIZE = 4096

/** The first rows of kitty's rowcolumn-diacritics table. */
const ROW_DIACRITICS = [
  '̅',
  '̍',
  '̎',
  '̐',
  '̒',
  '̽',
  '̾',
  '̿',
  '͆',
  '͊',
  '͋',
  '͌',
  '͐',
  '͑',
  '͒',
  '͗',
  '͛',
  'ͣ',
  'ͤ',
  'ͥ',
  'ͦ',
  'ͧ',
  'ͨ',
  'ͩ',
  'ͪ',
  'ͫ',
  'ͬ',
  'ͭ',
  'ͮ',
  'ͯ',
  '҃',
  '҄',
  '҅',
  '҆',
  '҇',
  '֒',
  '֓',
  '֔',
  '֕',
  '֗',
  '֘',
  '֙',
  '֜',
  '֝',
  '֞',
  '֟',
  '֠',
  '֡',
  '֨',
  '֩',
  '֫',
  '֬',
  '֯',
  'ׄ',
  'ؐ',
  'ؑ',
  'ؒ',
  'ؓ',
  'ؔ',
  'ؕ',
  'ؖ',
  'ؗ',
  'ؘ',
  'ؙ',
  'ؚ',
  'ٓ',
  'ٔ',
  'ٗ',
  '٘',
  'ۖ',
  'ۗ',
  'ۘ',
  'ۙ',
  'ۚ',
  'ۛ',
  'ۜ',
  '۟',
  '۠',
  'ۡ',
  'ۢ',
  'ۤ',
  'ۧ',
  'ۨ',
  '۫',
  '۬',
]

export const MAX_ROWS = ROW_DIACRITICS.length

const command = (control: string, payload = '') => `${ESC}_G${control};${payload}${ESC}\\`

/** tmux forwards a sequence to the outer terminal only inside a passthrough with its escapes doubled. */
export function wrapForTmux(sequence: string): string {
  return `${ESC}Ptmux;${sequence.replaceAll(ESC, `${ESC}${ESC}`)}${ESC}\\`
}

/** Uploads pixels under an id, without showing them. Returns one sequence per chunk. */
export function transmitImage(bitmap: Bitmap, id: number): string[] {
  const payload = deflateSync(bitmap.data).toString('base64')
  const chunks: string[] = []
  for (let start = 0; start < payload.length; start += CHUNK_SIZE) {
    const more = start + CHUNK_SIZE < payload.length ? 1 : 0
    const control = start === 0
      ? `a=t,f=32,o=z,s=${bitmap.width},v=${bitmap.height},i=${id},q=2,m=${more}`
      : `m=${more}`
    chunks.push(command(control, payload.slice(start, start + CHUNK_SIZE)))
  }
  return chunks
}

/** A virtual placement: where the image goes is decided by the placeholder cells. */
export function placeImage(id: number, cols: number, rows: number): string {
  return command(`a=p,U=1,i=${id},p=1,c=${cols},r=${rows},q=2`)
}

export function deleteImages(firstId: number, lastId: number): string {
  return command(`a=d,d=R,x=${firstId},y=${lastId},q=2`)
}

/** Cells that show an image. Only the first cell of a row is marked; the rest inherit from their left. */
export function placeholderLines(id: number, cols: number, rows: number): string[] {
  const color = `${ESC}[38;2;${(id >> 16) & 255};${(id >> 8) & 255};${id & 255}m`
  const lines: string[] = []
  for (let row = 0; row < Math.min(rows, MAX_ROWS); row++)
    lines.push(`${color}${PLACEHOLDER}${ROW_DIACRITICS[row]}${PLACEHOLDER.repeat(cols - 1)}${ESC}[39m`)
  return lines
}

/** The largest size in cells that keeps the image's proportions. */
export function fitCells(
  image: { width: number, height: number },
  cell: { width: number, height: number },
  maxCols: number,
  maxRows: number,
): { cols: number, rows: number } {
  const rowsPerCol = (image.height / image.width) * (cell.width / cell.height)
  const cols = Math.max(1, Math.min(maxCols, Math.floor(maxRows / rowsPerCol)))
  return { cols, rows: Math.max(1, Math.min(maxRows, Math.round(cols * rowsPerCol))) }
}

export type Backend = 'kitty' | 'halfblock'

export function chooseBackend(input: { requested?: string, inTmux: boolean, termName: string, passthrough: boolean }): Backend {
  if (input.requested === 'kitty' || input.requested === 'halfblock')
    return input.requested
  const supported = /ghostty|kitty/.test(input.termName)
  return supported && (!input.inTmux || input.passthrough) ? 'kitty' : 'halfblock'
}
