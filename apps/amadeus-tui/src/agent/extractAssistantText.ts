import type { AgentMessage } from '@earendil-works/pi-agent-core'

/**
 * Concatenates the plain text portions of an assistant message, ignoring
 * thinking blocks and tool calls. Returns `''` for non-assistant messages
 * or messages with no text content.
 *
 * Use when:
 * - Rendering the assistant's reply to the user.
 * - Parsing the response (e.g. extracting `<amadeus_state>` blocks).
 */
export function extractAssistantText(message: AgentMessage): string {
  if (!('role' in message) || message.role !== 'assistant') {
    return ''
  }

  let text = ''
  for (const part of message.content) {
    if (part.type === 'text') {
      text += part.text
    }
  }
  return text
}
