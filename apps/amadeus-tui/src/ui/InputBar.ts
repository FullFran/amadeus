import type { TUI } from '@earendil-works/pi-tui'

import { Editor } from '@earendil-works/pi-tui'

import { editorTheme } from './theme.js'

export type SubmitHandler = (text: string) => Promise<void> | void

/**
 * Editor wired with the Amadeus submit pipeline:
 *  - empty submissions are ignored
 *  - submitted text is added to history (up/down recall)
 *  - the editor is cleared after submit so the next prompt starts fresh
 *  - the handler decides what the text means (slash command, prompt, …)
 *
 * Slash-command autocomplete (registered via `setAutocompleteProvider`) lives
 * here too in WP7-9 — for WP5 we only ship the editor + submit plumbing and
 * let `/quit` fall through to the handler.
 */
export class InputBar extends Editor {
  constructor(tui: TUI, handler: SubmitHandler) {
    super(tui, editorTheme, { paddingX: 2 })

    this.onSubmit = (text: string) => {
      const trimmed = text.trim()
      if (trimmed === '') {
        return
      }
      this.addToHistory(trimmed)
      this.setText('')
      void Promise.resolve(handler(trimmed)).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error)
        process.stderr.write(`[input handler error] ${message}\n`)
      })
    }
  }
}
