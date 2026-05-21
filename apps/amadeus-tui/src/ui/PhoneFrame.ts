import type { Component } from '@earendil-works/pi-tui'

import { Box } from '@earendil-works/pi-tui'

import { crtBg } from './theme.js'

/**
 * Steins;Gate phone frame — a pi-tui `Box` with green-CRT background and the
 * outer padding that makes the inside feel like a phone screen. The Box
 * stacks its children vertically, so pass them in render order.
 *
 * Kept as a thin factory (not a Component subclass) because the only thing
 * that's actually opinionated here is the visual config — composition is
 * handled by the standard Box. Swap the bgFn at runtime via `frame.setBgFn`
 * if a future Mood theme needs to recolor the chassis.
 */
export function createPhoneFrame(children: Component[]): Box {
  const frame = new Box(2, 1, crtBg)
  for (const child of children) {
    frame.addChild(child)
  }
  return frame
}
