import type { RelationshipState } from '@amadeus/contracts'
import type { Component } from '@earendil-works/pi-tui'

import { visibleWidth } from '@earendil-works/pi-tui'
import chalk from 'chalk'

import { accent, crtBg, muted } from './theme.js'

/** Cells in each dimension bar. trust 0..100 maps onto 0..BAR_CELLS filled. */
const BAR_CELLS = 5

const trustInk = (text: string): string => chalk.bgBlack.greenBright(text)
const warmInk = (text: string): string => chalk.bgBlack.green(text)
const annoyInk = (text: string): string => chalk.bgBlack.red(text)

function bar(value: number, paint: (text: string) => string): string {
  const v = Math.max(0, Math.min(100, Math.round(value)))
  const filled = Math.round((v / 100) * BAR_CELLS)
  return paint('█'.repeat(filled)) + muted('░'.repeat(BAR_CELLS - filled))
}

/**
 * The relationship made VISIBLE — a one-line vitals strip under the portrait:
 * narrative stage + live trust / affection / familiarity / annoyance bars. The
 * soul feeds it after each turn (see attachStateHooks), so the user watches
 * trust climb (or annoyance spike, in red) as they talk — the difference
 * between "she warmed up somehow" and SEEING it happen.
 *
 * Renders exactly one line, padded to the full width with the CRT background,
 * and degrades gracefully on narrow terminals: dimension segments are added
 * greedily and the ones that don't fit are simply dropped (stage first, then
 * trust, …), never overflowing the row.
 */
export class StatusHud implements Component {
  private state: RelationshipState

  constructor(initial: RelationshipState) {
    this.state = initial
  }

  setRelationship(state: RelationshipState): void {
    this.state = state
  }

  invalidate(): void {
    // Stateless beyond the relationship snapshot.
  }

  render(width: number): string[] {
    const s = this.state
    // Order = drop priority on narrow terminals: trust and annoyance are the
    // headline signals (does she trust you / is she mad), so they survive when
    // affection/familiarity get squeezed off the end.
    const segments: Array<{ label: string, value: number, paint: (text: string) => string }> = [
      { label: 'trust', value: s.trust, paint: trustInk },
      { label: 'ann', value: s.annoyance, paint: annoyInk },
      { label: 'aff', value: s.affection, paint: warmInk },
      { label: 'fam', value: s.familiarity, paint: warmInk },
    ]

    let line = accent(`‹${s.stage}›`)
    let used = visibleWidth(line)

    for (const { label, value, paint } of segments) {
      const num = Math.round(Math.max(0, Math.min(100, value))).toString().padStart(2, ' ')
      const segment = `  ${muted(label)} ${bar(value, paint)} ${paint(num)}`
      const segmentWidth = visibleWidth(segment)
      if (used + segmentWidth > width) {
        break
      }
      line += segment
      used += segmentWidth
    }

    if (used < width) {
      line += crtBg(' '.repeat(width - used))
    }

    return [line]
  }
}
