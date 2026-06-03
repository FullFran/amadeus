import type { Mood } from '@amadeus/contracts'

/**
 * ASCII/ANSI portrait art per mood — a stylized bust of Kurisu rendered in
 * monospace box-drawing (hair + ahoge, face, lab-coat collar). Each mood ships
 * TWO frames:
 *   [0] eyes open  (~95% of idle time)
 *   [1] eyes blink (~5%, drives the natural blink in WaifuPortrait)
 *
 * The bust scaffold is constant; only the EXPRESSION — brow, eyes, mouth —
 * changes per mood, and the eyes close on the blink frame. The renderer centers
 * each line individually and applies a single per-mood tint (theme `moodColor`),
 * a monochrome CRT look that suits the Steins;Gate phone.
 *
 * ALIGNMENT CONTRACT: every row is 13 visible columns and every expression
 * token (brow/eyes/mouth) is exactly 5 columns, so the face edges line up
 * vertically. Glyphs are deliberately all single-width (box-drawing + geometric
 * shapes) — avoid CJK/emoji, which render double-width and shear the art. The
 * ascii.test.ts guard asserts the row count + per-row width so a bad edit fails
 * loudly instead of rendering crooked.
 */

const PORTRAIT_WIDTH = 13

interface Expression {
  /** 5-column forehead accent (brow / furrow / sparkle). */
  brow: string
  /** 5-column eye row ("open" frame). */
  eyes: string
  /** 5-column mouth. */
  mouth: string
}

/** Closed eyes shared by every mood's blink frame (5 columns). */
const BLINK_EYES = '─   ─'

function bust(e: Expression, eyes: string): string {
  return [
    '     ╲╿╱     ',
    '  ╭───────╮  ',
    ' ╭╯▒▒▒▒▒▒▒╰╮ ',
    '╭╯▒╲▔▔▔▔▔╱▒╰╮',
    `│▒░ ${e.brow} ░▒│`,
    `│░  ${eyes}  ░│`,
    '│     ▿     │',
    `│   ${e.mouth}   │`,
    '╰╮▁▁▁▁▁▁▁▁▁╭╯',
    '    │╱ ╲│    ',
    '  ╔═╧═══╧═╗  ',
  ].join('\n')
}

function frames(e: Expression): readonly [string, string] {
  return [bust(e, e.eyes), bust(e, BLINK_EYES)]
}

const EXPRESSIONS: Record<Mood, Expression> = {
  neutral: { brow: '     ', eyes: '◕   ◕', mouth: '  ‿  ' },
  thinking: { brow: '  ✦  ', eyes: '◔   ◔', mouth: '  ─  ' },
  annoyed: { brow: '╲   ╱', eyes: '◣   ◢', mouth: '  ⌄  ' },
  smug: { brow: '     ', eyes: '◑   ◑', mouth: '  ⌣  ' },
  embarrassed: { brow: '╳   ╳', eyes: '>   <', mouth: '  o  ' },
  soft: { brow: '     ', eyes: '◡   ◡', mouth: '  ◡  ' },
  serious: { brow: '─────', eyes: '▬   ▬', mouth: '  ▭  ' },
}

export const ASCII_PORTRAIT_FRAMES: Record<Mood, readonly [string, string]> = {
  neutral: frames(EXPRESSIONS.neutral),
  thinking: frames(EXPRESSIONS.thinking),
  annoyed: frames(EXPRESSIONS.annoyed),
  smug: frames(EXPRESSIONS.smug),
  embarrassed: frames(EXPRESSIONS.embarrassed),
  soft: frames(EXPRESSIONS.soft),
  serious: frames(EXPRESSIONS.serious),
}

export const PORTRAIT_HEIGHT_LINES = 11
export const PORTRAIT_NOMINAL_WIDTH = PORTRAIT_WIDTH
