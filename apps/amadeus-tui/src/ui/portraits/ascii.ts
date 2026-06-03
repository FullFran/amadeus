import type { Mood } from '@amadeus/contracts'

/**
 * ASCII placeholders per mood — bridge until real PNGs land in
 * `apps/amadeus-tui/assets/portraits/`. Each mood ships TWO frames:
 *   [0] eyes open  (~95% of idle time)
 *   [1] eyes blink (~5%, drives the natural blink in WaifuPortrait)
 *
 * The closed-eyes blink is computed by swapping the eye row for a flat dash
 * so the mood-specific accent (brows, mouth, blush) stays intact during the
 * blink — the same face just blinking, not a different mood.
 *
 * Color is applied at render time by mapping the mood through
 * `theme.moodColor`.
 */

const BLINK_EYES = '─   ─'

interface FaceParts {
  /** 5-cell-wide eye row. */
  eyes: string
  /** 1-cell mouth character. */
  mouth: string
  /** 1-cell forehead accent (brows, blush mark, sparkle, …). */
  brow: string
}

const FACE_PARTS: Record<Mood, FaceParts> = {
  neutral: { eyes: '◕   ◕', mouth: '‿', brow: ' ' },
  thinking: { eyes: '◔   ◔', mouth: '─', brow: '✦' },
  annoyed: { eyes: '▼   ▼', mouth: '﹏', brow: '✖' },
  smug: { eyes: '◑   ◑', mouth: '⌣', brow: ' ' },
  embarrassed: { eyes: '>   <', mouth: 'o', brow: '❀' },
  soft: { eyes: '‿   ‿', mouth: '◡', brow: ' ' },
  serious: { eyes: '─   ─', mouth: '▔', brow: ' ' },
}

function renderFace(parts: FaceParts, eyesOverride?: string): string {
  const eyes = eyesOverride ?? parts.eyes
  return [
    '   ╔═══════╗',
    `   ║   ${parts.brow}   ║`,
    `   ║ ${eyes} ║`,
    '   ║   ·   ║',
    `   ║   ${parts.mouth}   ║`,
    '   ║       ║',
    '   ╚═══╤═══╝',
    '       │     ',
  ].join('\n')
}

export const ASCII_PORTRAIT_FRAMES: Record<Mood, readonly [string, string]> = {
  neutral: [renderFace(FACE_PARTS.neutral), renderFace(FACE_PARTS.neutral, BLINK_EYES)],
  thinking: [renderFace(FACE_PARTS.thinking), renderFace(FACE_PARTS.thinking, BLINK_EYES)],
  annoyed: [renderFace(FACE_PARTS.annoyed), renderFace(FACE_PARTS.annoyed, BLINK_EYES)],
  smug: [renderFace(FACE_PARTS.smug), renderFace(FACE_PARTS.smug, BLINK_EYES)],
  embarrassed: [renderFace(FACE_PARTS.embarrassed), renderFace(FACE_PARTS.embarrassed, BLINK_EYES)],
  soft: [renderFace(FACE_PARTS.soft), renderFace(FACE_PARTS.soft, BLINK_EYES)],
  serious: [renderFace(FACE_PARTS.serious), renderFace(FACE_PARTS.serious, BLINK_EYES)],
}

export const PORTRAIT_HEIGHT_LINES = 8
export const PORTRAIT_NOMINAL_WIDTH = 13
