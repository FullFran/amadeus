import { sanitizeResponse } from '@amadeus/character'
import { Markdown } from '@earendil-works/pi-tui'

import { markdownTheme } from './theme.js'

interface Turn {
  role: 'user' | 'assistant'
  /** Sanitized markdown — never the raw `<amadeus_state>` payload. */
  text: string
}

const TURN_SEPARATOR = '\n\n---\n\n'

/**
 * Markdown-backed transcript. Extends `Markdown` so the TUI can mount it
 * directly as a child; the extra surface area is just transcript management.
 *
 * Streaming flow:
 *   beginAssistantTurn()        — pushes an empty assistant turn
 *   updateAssistantTurn(raw)    — called per `message_update`, sanitizes
 *                                 and updates the active turn in place
 *   finalizeAssistantTurn(raw)  — called on `message_end` (idempotent)
 *
 * `appendUserTurn(text)` is fire-and-forget: pushes a user turn and
 * implicitly closes any in-flight streaming turn that the user interrupted.
 */
export class ChatPane extends Markdown {
  private turns: Turn[] = []

  constructor() {
    super('', 2, 1, markdownTheme)
  }

  appendUserTurn(text: string): void {
    this.turns.push({ role: 'user', text: text.trim() })
    this.refresh()
  }

  beginAssistantTurn(): void {
    this.turns.push({ role: 'assistant', text: '' })
    this.refresh()
  }

  updateAssistantTurn(rawText: string): void {
    const last = this.turns[this.turns.length - 1]
    if (last === undefined || last.role !== 'assistant') {
      // Defensive — caller never opened a turn. Open one now so we don't drop the chunk.
      this.turns.push({ role: 'assistant', text: '' })
    }
    this.turns[this.turns.length - 1]!.text = sanitizeResponse(rawText)
    this.refresh()
  }

  finalizeAssistantTurn(rawText: string): void {
    this.updateAssistantTurn(rawText)
  }

  /** Diagnostic / system notice appended as a quoted line — used for errors. */
  appendSystemNotice(text: string): void {
    this.turns.push({ role: 'assistant', text: `> _${text}_` })
    this.refresh()
  }

  private refresh(): void {
    const body = this.turns
      .map(turn => formatTurn(turn))
      .join(TURN_SEPARATOR)
    this.setText(body)
  }
}

function formatTurn(turn: Turn): string {
  if (turn.role === 'user') {
    return `**> ${turn.text}**`
  }
  return turn.text
}
