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
 * — no extra orchestration here, just the explicit child order. WaifuPortrait
 * (WP6) will slot between Header and ChatPane; StatusHud (WP8) will live as
 * an `tui.showOverlay` anchored bottom-center.
 */
export function composeAmadeusLayout(
  header: Component,
  portrait: Component,
  chatPane: Component,
  inputBar: Component,
): Component {
  return createPhoneFrame([header, portrait, chatPane, inputBar])
}
