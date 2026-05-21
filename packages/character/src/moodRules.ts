import type { Mood, RelationshipState } from '@amadeus/contracts'

export interface MoodResolutionInput {
  /** The mood the LLM emitted in its `<amadeus_state>` block. */
  llmMood: Mood
  /** Current relationship state, post-update. */
  state: RelationshipState
}

const ANNOYANCE_OVERRIDE_THRESHOLD = 70

/**
 * Applies post-LLM mood policy. The LLM proposes a mood; this function may
 * override it based on hard rules the persona must not violate.
 *
 * Use when:
 * - Right after `parseAmadeusState` succeeds, before driving the portrait.
 *
 * Expects:
 * - A parsed `Mood` from the assistant.
 * - The current {@link RelationshipState} (already updated for this turn).
 *
 * Returns:
 * - The mood that should actually drive the UI. Equals `llmMood` unless a
 *   rule forces an override.
 */
export function resolveMood(input: MoodResolutionInput): Mood {
  const { llmMood, state } = input

  if (state.annoyance >= ANNOYANCE_OVERRIDE_THRESHOLD && !isAnnoyanceCongruent(llmMood)) {
    return 'annoyed'
  }

  return llmMood
}

function isAnnoyanceCongruent(mood: Mood): boolean {
  return mood === 'annoyed' || mood === 'serious'
}
