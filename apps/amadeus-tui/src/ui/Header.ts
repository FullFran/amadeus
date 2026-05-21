import type { Component } from '@earendil-works/pi-tui'
import type { Mode } from '@amadeus/contracts'

import { visibleWidth } from '@earendil-works/pi-tui'

import { accent, crtBg, muted } from './theme.js'

export type HeaderStatus = 'idle' | 'thinking' | 'streaming' | 'error'

const STATUS_GLYPH: Record<HeaderStatus, string> = {
  idle: '◉',
  thinking: '◐',
  streaming: '◑',
  error: '◯',
}

/**
 * Single-line header: clock left, AMADEUS [mode] center-left, status right.
 * Implemented as a custom Component (not TruncatedText) so it can mutate
 * mode/status/clock in place without re-instantiation.
 *
 * The owner is responsible for ticking the clock — call `tick()` once a
 * minute followed by `tui.requestRender()`. Keeps Header decoupled from TUI.
 */
export class Header implements Component {
  private mode: Mode
  private status: HeaderStatus
  private clock: string

  constructor(initialMode: Mode = 'companion', initialStatus: HeaderStatus = 'idle') {
    this.mode = initialMode
    this.status = initialStatus
    this.clock = currentClock()
  }

  setMode(mode: Mode): void {
    this.mode = mode
  }

  setStatus(status: HeaderStatus): void {
    this.status = status
  }

  /** Refresh the cached clock string. Caller must `tui.requestRender()` after. */
  tick(): void {
    this.clock = currentClock()
  }

  invalidate(): void {
    // Stateless render — nothing cached beyond the public mutables.
  }

  render(width: number): string[] {
    const left = `${this.clock}  ${accent('AMADEUS')} ${muted(`[${this.mode}]`)}`
    const right = `${STATUS_GLYPH[this.status]} ${this.status}`

    const leftVisible = visibleWidth(left)
    const rightVisible = visibleWidth(right)
    const gap = Math.max(1, width - leftVisible - rightVisible)
    const line = `${left}${crtBg(' '.repeat(gap))}${right}`

    return [line]
  }
}

function currentClock(): string {
  const now = new Date()
  const hh = now.getHours().toString().padStart(2, '0')
  const mm = now.getMinutes().toString().padStart(2, '0')
  return accent(`${hh}:${mm}`)
}
