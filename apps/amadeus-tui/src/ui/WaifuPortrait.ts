import type { Mood } from '@amadeus/contracts'
import type { Component, TUI } from '@earendil-works/pi-tui'

import type { PortraitRenderer } from './portraits/PortraitRenderer.js'

/**
 * Default idle animation tick. The render-decision logic uses this to drive a
 * natural blink: ~3s eyes-open, ~150ms eyes-closed, repeat. With a 150ms tick
 * that's 20 ticks open + 1 tick closed = blink every ~3.15s. Feels alive
 * without being twitchy.
 */
const DEFAULT_TICK_MS = 150
const OPEN_TICKS_BEFORE_BLINK = 20

/**
 * The visual presence of Kurisu. Mood-agnostic in code — it just stores the
 * current mood + animation frame and delegates rendering to the active
 * `PortraitRenderer`.
 *
 * Animation: the portrait owns an internal tick counter (`tickIndex`). The
 * displayed frame is decided per-render from the renderer's reported
 * `frameCount` and a simple blink pattern (frame 0 most of the time, frame
 * 1 on the blink beat). This way:
 *   - PNGs (frameCount === 1) just show frame 0 — no flicker.
 *   - ASCII (frameCount === 2) blinks naturally.
 *   - Future renderers with N>2 frames can extend the pattern.
 *
 * The owner calls `startAnimation(tui)` once at boot and `stopAnimation()`
 * on shutdown. Mood swaps via `setMood(mood)` are immediate; the tick
 * keeps rolling so the new mood inherits the same blink rhythm.
 */
export class WaifuPortrait implements Component {
  private mood: Mood
  private tickIndex = 0
  private animationTimer?: NodeJS.Timeout

  constructor(
    private readonly renderer: PortraitRenderer,
    initialMood: Mood = 'neutral',
  ) {
    this.mood = initialMood
  }

  setMood(mood: Mood): boolean {
    if (this.mood === mood) {
      return false
    }
    this.mood = mood
    return true
  }

  getMood(): Mood {
    return this.mood
  }

  startAnimation(tui: TUI, tickMs: number = DEFAULT_TICK_MS): void {
    if (this.animationTimer !== undefined) {
      return
    }
    this.animationTimer = setInterval(() => {
      this.tickIndex = (this.tickIndex + 1) % (OPEN_TICKS_BEFORE_BLINK + 1)
      tui.requestRender()
    }, tickMs)
  }

  stopAnimation(): void {
    if (this.animationTimer !== undefined) {
      clearInterval(this.animationTimer)
      this.animationTimer = undefined
    }
  }

  invalidate(): void {
    // Stateless beyond mood/tick; the renderer caches as needed.
  }

  render(width: number): string[] {
    const frames = this.renderer.frameCount(this.mood)
    const frameIndex = this.pickFrame(frames)
    return this.renderer.renderMood(this.mood, frameIndex, width)
  }

  /**
   * Two-frame renderers (open/blink) get the natural blink pattern. Renderers
   * with one frame always show 0. Renderers with more than two frames cycle
   * uniformly through tickIndex — leaves room for richer animations later.
   */
  private pickFrame(frames: number): number {
    if (frames <= 1) {
      return 0
    }
    if (frames === 2) {
      return this.tickIndex === OPEN_TICKS_BEFORE_BLINK ? 1 : 0
    }
    return this.tickIndex % frames
  }
}
