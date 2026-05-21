import type { Agent, AgentMessage } from '@earendil-works/pi-agent-core'
import type { AssistantMessage } from '@earendil-works/pi-ai'

import { parseAmadeusState } from '@amadeus/contracts'
import { sanitizeResponse } from '@amadeus/character'

import { extractAssistantText } from './extractAssistantText.js'

function isAssistantMessage(message: AgentMessage): message is AssistantMessage {
  return 'role' in message && message.role === 'assistant'
}

/**
 * WP4 prove-of-life output:
 * - on `message_start` (assistant only): prints `[Kurisu thinking...]\n`.
 * - on `message_end` (assistant only): prints the SANITIZED full reply at once
 *   and logs the parsed `<amadeus_state>` to stderr.
 *
 * Live token streaming intentionally lives in WP5 (pi-tui ChatPane). Printing
 * incrementally on stdout would leak the start of the protocol block (e.g. a
 * preceding ```xml fence) since the terminal has no way to "un-print".
 */
export function attachStateHooks(agent: Agent): () => void {
  return agent.subscribe((event) => {
    if (event.type === 'message_start') {
      if (!isAssistantMessage(event.message)) {
        return
      }
      process.stdout.write('[Kurisu thinking...]\n')
      return
    }

    if (event.type !== 'message_end' || !isAssistantMessage(event.message)) {
      return
    }

    if (event.message.stopReason === 'error' || event.message.stopReason === 'aborted') {
      process.stderr.write(`[llm ${event.message.stopReason}] ${event.message.errorMessage ?? '(no message)'}\n`)
      return
    }

    const raw = extractAssistantText(event.message)
    if (raw.length === 0) {
      process.stderr.write(`[warn] empty assistant message (stopReason=${event.message.stopReason})\n`)
      return
    }

    const visible = sanitizeResponse(raw)
    if (visible.length > 0) {
      process.stdout.write(`\n${visible}\n\n`)
    }

    const result = parseAmadeusState(raw)
    if (result.ok) {
      const { mood, relationshipDelta, memoryCandidates } = result.state
      process.stderr.write(
        `[state] mood=${mood} delta=${JSON.stringify(relationshipDelta)} candidates=${memoryCandidates.length}\n`,
      )
    }
    else {
      process.stderr.write(`[state] parse failed: ${result.error.kind}\n`)
    }
  })
}
