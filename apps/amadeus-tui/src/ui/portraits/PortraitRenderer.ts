import type { Mood } from '@amadeus/contracts'

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { detectCapabilities, getPngDimensions, Image, visibleWidth } from '@earendil-works/pi-tui'

import { moodColor } from '../theme.js'
import { ASCII_PORTRAIT_FRAMES, PORTRAIT_HEIGHT_LINES } from './ascii.js'

/**
 * A renderer turns a `Mood` + frame index into the visible portrait lines for
 * a given viewport width. The TUI doesn't care HOW the portrait is produced
 * (ASCII, PNG via Kitty/iTerm2, Live2D post-MVP) — only that the contract
 * holds: every implementation MUST return exactly `expectedHeight` lines so
 * the layout stays stable when moods/frames swap mid-conversation, and MUST
 * report `frameCount` so the WaifuPortrait knows how to cycle the bucle.
 */
export interface PortraitRenderer {
  readonly expectedHeight: number
  frameCount: (mood: Mood) => number
  renderMood: (mood: Mood, frameIndex: number, width: number) => string[]
}

const ALL_MOODS: Mood[] = [
  'neutral',
  'thinking',
  'annoyed',
  'smug',
  'embarrassed',
  'soft',
  'serious',
]

const PORTRAIT_MIME = 'image/png'

/**
 * ASCII fallback — always available, works on any terminal. Lookups the
 * mood frames in `ASCII_PORTRAIT_FRAMES`, picks the requested frame, tints
 * it with `theme.moodColor`, and centers it horizontally in the given width.
 */
export class AsciiPortraitRenderer implements PortraitRenderer {
  readonly expectedHeight = PORTRAIT_HEIGHT_LINES

  frameCount(mood: Mood): number {
    return ASCII_PORTRAIT_FRAMES[mood].length
  }

  renderMood(mood: Mood, frameIndex: number, width: number): string[] {
    const colorize = moodColor[mood]
    const frames = ASCII_PORTRAIT_FRAMES[mood]
    const frame = frames[frameIndex % frames.length] ?? frames[0]
    const raw = frame.split('\n')

    return raw.map((line) => {
      const padding = Math.max(0, Math.floor((width - visibleWidth(line)) / 2))
      return ' '.repeat(padding) + colorize(line)
    })
  }
}

/**
 * PNG renderer — uses pi-tui's `Image` component (Kitty graphics protocol
 * or iTerm2 inline images). Loads every mood at construction time so a
 * mood swap is just a Component lookup, not disk I/O. Falls back to ASCII
 * for any mood whose PNG is missing — partial coverage is fine.
 */
export class ImagePortraitRenderer implements PortraitRenderer {
  readonly expectedHeight: number
  private readonly images: Partial<Record<Mood, Image>> = {}
  private readonly asciiFallback = new AsciiPortraitRenderer()

  constructor(assetsDir: string, maxHeightCells: number) {
    this.expectedHeight = maxHeightCells
    const theme = { fallbackColor: moodColor.neutral }

    for (const mood of ALL_MOODS) {
      const path = join(assetsDir, `${mood}.png`)
      if (!existsSync(path)) {
        continue
      }
      const buf = readFileSync(path)
      const base64 = buf.toString('base64')
      const dimensions = getPngDimensions(base64)
      if (dimensions === null) {
        process.stderr.write(`[portrait] could not read PNG dimensions for ${mood}\n`)
        continue
      }
      this.images[mood] = new Image(
        base64,
        PORTRAIT_MIME,
        theme,
        { maxHeightCells, filename: `${mood}.png` },
        dimensions,
      )
    }
  }

  frameCount(mood: Mood): number {
    // PNG renderer is single-frame per mood for now. The animation loop
    // still ticks but the picked frame is always 0 — no flicker.
    if (this.images[mood] !== undefined) {
      return 1
    }
    return this.asciiFallback.frameCount(mood)
  }

  renderMood(mood: Mood, frameIndex: number, width: number): string[] {
    const image = this.images[mood]
    if (image === undefined) {
      return padToHeight(this.asciiFallback.renderMood(mood, frameIndex, width), this.expectedHeight)
    }
    const lines = image.render(width)
    return padToHeight(lines, this.expectedHeight)
  }
}

/**
 * Picks the strongest renderer the current environment supports:
 *  1. Try `ImagePortraitRenderer` if the terminal advertises Kitty/iTerm2
 *     AND at least one PNG exists on disk.
 *  2. Otherwise fall back to `AsciiPortraitRenderer`.
 *
 * Returns the renderer plus a short tag for logging/diagnostics.
 */
export function createPortraitRenderer(): { renderer: PortraitRenderer, tag: string } {
  const caps = detectCapabilities()
  if (caps.images === null) {
    return { renderer: new AsciiPortraitRenderer(), tag: 'ascii (no terminal image support)' }
  }

  const assetsDir = resolveAssetsDir()
  if (!hasAnyPortraitAsset(assetsDir)) {
    return { renderer: new AsciiPortraitRenderer(), tag: 'ascii (no PNG assets in assets/portraits/)' }
  }

  return {
    renderer: new ImagePortraitRenderer(assetsDir, PORTRAIT_HEIGHT_LINES * 2),
    tag: `image (${caps.images}) — assetsDir=${assetsDir}`,
  }
}

function resolveAssetsDir(): string {
  const here = dirname(fileURLToPath(import.meta.url))
  // src/ui/portraits/PortraitRenderer.ts  → ../../../assets/portraits
  // dist/ui/portraits/PortraitRenderer.js → ../../../assets/portraits
  return join(here, '..', '..', '..', 'assets', 'portraits')
}

function hasAnyPortraitAsset(assetsDir: string): boolean {
  return ALL_MOODS.some(mood => existsSync(join(assetsDir, `${mood}.png`)))
}

function padToHeight(lines: string[], height: number): string[] {
  if (lines.length === height) {
    return lines
  }
  if (lines.length > height) {
    return lines.slice(0, height)
  }
  return [...lines, ...Array.from({ length: height - lines.length }, () => '')]
}
