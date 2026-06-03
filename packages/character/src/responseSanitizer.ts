// Eats an optional leading markdown code fence (```xml, ```json, ```, …) and
// its trailing fence so the visible text is not left with an empty fence when
// the model decides to wrap the protocol payload in markdown. The `\s*` on
// both sides absorbs blank lines models often insert between the fence and
// the tag.
const STATE_BLOCK_REGEX = /(?:`{3}[\w-]*\s*)?<amadeus_state>[\s\S]*?<\/amadeus_state>(?:\s*`{3})?/g

// During streaming the block arrives at the TAIL of the message char-by-char,
// so for the whole window between the opening tag and its close the payload is
// an UNCLOSED block that STATE_BLOCK_REGEX (which needs a complete pair) won't
// touch — leaking raw `<amadeus_state>{ "mood": …` JSON onto the screen. This
// removes a trailing, not-yet-closed block: an optional opening fence, the
// `<amadeus_state` marker, and everything after it to end-of-string. It only
// ever bites the tail (`$`-anchored) and requires the literal marker, so a
// stray `<` in legit prose is never stripped, and a bare ```` ``` ```` fence is
// only removed when our tag actually follows it.
const STREAMING_TAIL_REGEX = /(?:`{3}[\w-]*\s*)?<amadeus_state[\s\S]*$/

/**
 * Strips every `<amadeus_state>...</amadeus_state>` block from an assistant
 * response so the visible UI never shows the hidden protocol payload.
 *
 * Use when:
 * - Rendering assistant text to the user (TUI ChatPane, web view, logs),
 *   including on every streaming chunk.
 *
 * Expects:
 * - Arbitrary assistant text, possibly containing zero, one, or many complete
 *   state blocks, plus an optional UNCLOSED trailing block while streaming.
 *
 * Returns:
 * - The text with all complete blocks removed AND any trailing unclosed block
 *   hidden, surrounding whitespace collapsed at the seams, and trailing
 *   whitespace trimmed.
 */
export function sanitizeResponse(text: string): string {
  return text
    .replace(STATE_BLOCK_REGEX, '')
    .replace(STREAMING_TAIL_REGEX, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd()
}
