import type { Mood } from '@amadeus/contracts'
import type { EditorTheme, MarkdownTheme } from '@earendil-works/pi-tui'

import chalk from 'chalk'

/**
 * Steins;Gate phone aesthetic — green CRT phosphor on black.
 *
 * Every color helper is a pure `string -> string` function so it can be
 * dropped into pi-tui `Box.bgFn`, `Text.customBgFn`, `MarkdownTheme.*`, etc.
 * without wrapping. Functions, not strings, because chalk composes that way.
 */

/** Box background: black bg with green fg fills empty cells with the CRT look. */
export const crtBg = (text: string): string => chalk.bgBlack.green(text)

/** Header / status accents — slightly brighter, bold. */
export const accent = (text: string): string => chalk.bgBlack.greenBright.bold(text)

/** Secondary text — dim green for chrome that should recede. */
export const muted = (text: string): string => chalk.bgBlack.green.dim(text)

/** User-turn marker color (kept distinct from assistant for transcript scanning). */
export const userInk = (text: string): string => chalk.bgBlack.cyanBright(text)

/**
 * Mood → portrait/highlight color. Used by WP6 WaifuPortrait fallback and
 *  WP8 StatusHud accents. Kept here so the persona colour vocabulary lives in
 *  ONE place.
 */
export const moodColor: Record<Mood, (text: string) => string> = {
  neutral: chalk.bgBlack.green,
  thinking: chalk.bgBlack.cyan,
  annoyed: chalk.bgBlack.red,
  smug: chalk.bgBlack.magenta,
  embarrassed: chalk.bgBlack.yellow,
  soft: chalk.bgBlack.greenBright,
  serious: chalk.bgBlack.whiteBright,
}

/** Markdown rendering for the ChatPane — every element styled on the CRT bg. */
export const markdownTheme: MarkdownTheme = {
  heading: text => chalk.bgBlack.greenBright.bold(text),
  link: text => chalk.bgBlack.cyan.underline(text),
  linkUrl: text => chalk.bgBlack.cyan.dim(text),
  code: text => chalk.bgBlack.greenBright(text),
  codeBlock: text => chalk.bgBlack.green(text),
  codeBlockBorder: text => chalk.bgBlack.green.dim(text),
  quote: text => chalk.bgBlack.green.italic(text),
  quoteBorder: text => chalk.bgBlack.green.dim(text),
  hr: text => chalk.bgBlack.green.dim(text),
  listBullet: text => chalk.bgBlack.greenBright(text),
  bold: text => chalk.bgBlack.green.bold(text),
  italic: text => chalk.bgBlack.green.italic(text),
  strikethrough: text => chalk.bgBlack.green.strikethrough(text),
  underline: text => chalk.bgBlack.green.underline(text),
}

export const editorTheme: EditorTheme = {
  borderColor: text => chalk.bgBlack.green.dim(text),
  selectList: {
    selectedPrefix: text => chalk.bgGreen.black.bold(text),
    selectedText: text => chalk.bgGreen.black.bold(text),
    description: text => chalk.bgBlack.green.dim(text),
    scrollInfo: text => chalk.bgBlack.green.dim(text),
    noMatch: text => chalk.bgBlack.red(text),
  },
}
