import type { Component } from '@earendil-works/pi-tui'

import { createPhoneFrame } from './PhoneFrame.js'

/**
 * Top-level composition of the Steins;Gate phone TUI.
 *
 *   ┌── PhoneFrame ────────────────┐
 *   │ Header (clock + mode + ◉)   │
 *   │                              │
 *   │ ChatPane (transcript)        │
 *   │                              │
 *   │ InputBar (Editor)            │
 *   └──────────────────────────────┘
 *
 * Vertical stacking is what pi-tui's `Box` (and `Container`) already gives us
 * — no extra orchestration here, just the explicit child order: the portrait
 * is pinned at the top, the StatusHud reads her vitals right beneath it, and
 * the ChatPane takes the remaining height above the input.
 */
export function composeAmadeusLayout(
  header: Component,
  portrait: Component,
  statusHud: Component,
  chatPane: Component,
  inputBar: Component,
): Component {
  return createPhoneFrame([header, portrait, statusHud, chatPane, inputBar])
}
