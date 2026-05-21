import type { Agent, AgentEvent, AgentMessage } from '@earendil-works/pi-agent-core'
import type { AssistantMessage } from '@earendil-works/pi-ai'

import { parseAmadeusState } from '@amadeus/contracts'
import { sanitizeResponse } from '@amadeus/character'

import { extractAssistantText } from './extractAssistantText.js'

const TICKER_INTERVAL_MS = 1500
const DEBUG = process.env.AMADEUS_DEBUG === '1'

function isAssistantMessage(message: AgentMessage): message is AssistantMessage {
  return 'role' in message && message.role === 'assistant'
}

/**
 * WP4 prove-of-life output:
 * - on `message_start` (assistant only): prints `[Kurisu thinking` and starts a
 *   dot ticker so the user sees the run is alive even when the provider takes
 *   tens of seconds (Kimi K2.6 and other reasoning models do this often).
 * - on the first non-empty `message_update`: stops the ticker and writes
 *   `[receiving...]` so the user knows text is on the wire. The text itself
 *   stays buffered until `message_end` to avoid leaking the protocol block
 *   prefix (e.g. a leading ```xml fence).
 * - on `message_end` (assistant only): prints the SANITIZED full reply and
 *   logs the parsed `<amadeus_state>` to stderr. Surfaces provider errors
 *   and aborted runs explicitly so they don't look like a hang.
 *
 * Set `AMADEUS_DEBUG=1` to log every agent event to stderr — useful when the
 * provider hangs or the assistant message comes back empty.
 */
export function attachStateHooks(agent: Agent): () => void {
  let tickerHandle: NodeJS.Timeout | undefined
  let elapsedTicks = 0
  let textReceiving = false

  const startTicker = (): void => {
    elapsedTicks = 0
    process.stdout.write('[Kurisu thinking')
    tickerHandle = setInterval(() => {
      elapsedTicks += 1
      process.stdout.write('.')
    }, TICKER_INTERVAL_MS)
  }

  const stopTicker = (closeWith: string): void => {
    if (tickerHandle === undefined) {
      return
    }
    clearInterval(tickerHandle)
    tickerHandle = undefined
    process.stdout.write(`${closeWith}\n`)
  }

  return agent.subscribe((event: AgentEvent) => {
    if (DEBUG) {
      const summary = event.type === 'message_end' || event.type === 'message_start'
        ? `${event.type}(${'message' in event ? (event.message as { role: string }).role : '?'})`
        : event.type
      process.stderr.write(`[debug] ${summary}\n`)
    }

    if (event.type === 'message_start') {
      if (!isAssistantMessage(event.message)) {
        return
      }
      textReceiving = false
      startTicker()
      return
    }

    if (event.type === 'message_update' && isAssistantMessage(event.message) && !textReceiving) {
      const text = extractAssistantText(event.message)
      if (text.length > 0) {
        textReceiving = true
        stopTicker('] [receiving...]')
      }
      return
    }

    if (event.type === 'agent_end') {
      // Last-resort safety: if the run ended without ever closing the ticker,
      // close it now so the prompt comes back cleanly.
      stopTicker('] [no response]')
      return
    }

    if (event.type !== 'message_end' || !isAssistantMessage(event.message)) {
      return
    }

    stopTicker(textReceiving ? '' : '] [no text]')

    if (event.message.stopReason === 'error' || event.message.stopReason === 'aborted') {
      process.stderr.write(`[llm ${event.message.stopReason}] ${event.message.errorMessage ?? '(no message)'}\n`)
      return
    }

    const raw = extractAssistantText(event.message)
    if (raw.length === 0) {
      process.stderr.write(`[warn] empty assistant message (stopReason=${event.message.stopReason}, ticks=${elapsedTicks})\n`)
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
