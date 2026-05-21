// Eats an optional leading markdown code fence (```xml, ```json, ```, …) and
// its trailing fence so the visible text is not left with an empty fence when
// the model decides to wrap the protocol payload in markdown. The `\s*` on
// both sides absorbs blank lines models often insert between the fence and
// the tag.
const STATE_BLOCK_REGEX = /(?:`{3}[\w-]*\s*)?<amadeus_state>[\s\S]*?<\/amadeus_state>(?:\s*`{3})?/g

/**
 * Strips every `<amadeus_state>...</amadeus_state>` block from an assistant
 * response so the visible UI never shows the hidden protocol payload.
 *
 * Use when:
 * - Rendering assistant text to the user (TUI ChatPane, web view, logs).
 *
 * Expects:
 * - Arbitrary assistant text, possibly containing zero, one, or many state
 *   blocks. Streaming partial blocks are left intact (regex only matches
 *   complete `<...>...</...>` pairs) — call again once streaming completes.
 *
 * Returns:
 * - The text with all complete blocks removed, surrounding whitespace
 *   collapsed at the seams, and trailing whitespace trimmed.
 */
export function sanitizeResponse(text: string): string {
  return text
    .replace(STATE_BLOCK_REGEX, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd()
}
