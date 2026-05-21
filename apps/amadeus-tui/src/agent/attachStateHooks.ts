import type { Agent, AgentEvent, AgentMessage } from '@earendil-works/pi-agent-core'
import type { AssistantMessage } from '@earendil-works/pi-ai'
import type { TUI } from '@earendil-works/pi-tui'

import { parseAmadeusState } from '@amadeus/contracts'

import type { ChatPane } from '../ui/ChatPane.js'
import type { Header } from '../ui/Header.js'

import { extractAssistantText } from './extractAssistantText.js'

const DEBUG = process.env.AMADEUS_DEBUG === '1'

export interface StateHookTargets {
  chatPane: ChatPane
  header: Header
  tui: TUI
}

function isAssistantMessage(message: AgentMessage): message is AssistantMessage {
  return 'role' in message && message.role === 'assistant'
}

/**
 * Drives the WP5 TUI from the agent's lifecycle events:
 *
 *   message_start (assistant) → opens a streaming turn in the ChatPane,
 *                               flips Header.status to 'streaming'
 *   message_update            → updates the active turn's text live (the
 *                               Markdown component re-renders incrementally)
 *   message_end (assistant)   → finalizes the turn, parses the protocol
 *                               payload, surfaces errors as a system notice
 *   agent_end                 → safety: returns Header.status to 'idle'
 *
 * The sanitizer runs INSIDE `ChatPane.updateAssistantTurn`, so even partial
 * `<amadeus_state>` blocks never reach the rendered transcript.
 *
 * AMADEUS_DEBUG=1 logs every event to stderr.
 */
export function attachStateHooks(agent: Agent, targets: StateHookTargets): () => void {
  const { chatPane, header, tui } = targets

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
      chatPane.beginAssistantTurn()
      header.setStatus('thinking')
      tui.requestRender()
      return
    }

    if (event.type === 'message_update' && isAssistantMessage(event.message)) {
      const raw = extractAssistantText(event.message)
      if (raw.length === 0) {
        return
      }
      header.setStatus('streaming')
      chatPane.updateAssistantTurn(raw)
      tui.requestRender()
      return
    }

    if (event.type === 'agent_end') {
      header.setStatus('idle')
      tui.requestRender()
      return
    }

    if (event.type !== 'message_end' || !isAssistantMessage(event.message)) {
      return
    }

    if (event.message.stopReason === 'error' || event.message.stopReason === 'aborted') {
      chatPane.appendSystemNotice(
        `LLM ${event.message.stopReason}: ${event.message.errorMessage ?? 'no detail'}`,
      )
      header.setStatus('error')
      tui.requestRender()
      return
    }

    const raw = extractAssistantText(event.message)
    if (raw.length === 0) {
      chatPane.appendSystemNotice(`Empty assistant message (stopReason=${event.message.stopReason})`)
      tui.requestRender()
      return
    }

    chatPane.finalizeAssistantTurn(raw)
    tui.requestRender()

    const result = parseAmadeusState(raw)
    if (DEBUG) {
      if (result.ok) {
        const { mood, relationshipDelta, memoryCandidates } = result.state
        process.stderr.write(
          `[state] mood=${mood} delta=${JSON.stringify(relationshipDelta)} candidates=${memoryCandidates.length}\n`,
        )
      }
      else {
        process.stderr.write(`[state] parse failed: ${result.error.kind}\n`)
      }
    }
  })
}
