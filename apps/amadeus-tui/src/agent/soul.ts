import type { AmadeusState, Mode, RelationshipState } from '@amadeus/contracts'

import type { StoredMemory } from '@amadeus/memory'
import { join } from 'node:path'
import { buildSystemPrompt } from '@amadeus/character'
import { appendMemories, extractMemoryCandidates, loadMemories, saveMemories, searchMemory } from '@amadeus/memory'
import { applyDelta, loadRelationship, saveRelationship } from '@amadeus/relationship'

/** How many remembered facts to inject into the system prompt per turn. */
const RECENT_MEMORY_COUNT = 6

/**
 * The persistent SOUL of Amadeus — everything that must survive both the turn
 * and the process: the evolving {@link RelationshipState} and the user's
 * memories. The renderer (TUI) and the agent stay stateless about this; the
 * composition root owns one `Soul` and lets it mediate prompt composition and
 * post-turn persistence.
 *
 * Files live under `dataDir` (see config/env `resolveDataDir`):
 *   relationship.json — trust/affection/familiarity/annoyance + stage
 *   memory.json       — array of StoredMemory
 *
 * Both stores are crash-tolerant (loaders never throw; a missing or corrupt
 * file falls back to a fresh seed), so a first run just works.
 */
export interface Soul {
  readonly mode: Mode
  /** Current relationship state (post the last applied turn). */
  relationship: () => RelationshipState
  /**
   * Compose the system prompt for the NEXT model request: base persona + the
   * live relationship + the memories most relevant to `query` (the user's
   * current message). Called before every `agent.prompt(...)` so warmth and
   * recall update mid-session, not only across restarts.
   */
  composePrompt: (query: string) => string
  /**
   * Fold a parsed turn into the soul: clamp+apply the relationship delta and
   * persist it, retain memory candidates above the importance threshold and
   * persist them. Returns the new relationship so the caller can drive UI
   * (mood policy, status HUD). Persistence is best-effort and synchronous.
   */
  applyTurn: (state: AmadeusState) => RelationshipState
}

export function createSoul(dataDir: string, mode: Mode = 'companion'): Soul {
  const relationshipPath = join(dataDir, 'relationship.json')
  const memoryPath = join(dataDir, 'memory.json')

  let relationship = loadRelationship(relationshipPath)
  let memories: StoredMemory[] = loadMemories(memoryPath)

  return {
    mode,

    relationship: () => relationship,

    composePrompt(query: string): string {
      return buildSystemPrompt({
        mode,
        relationshipState: relationship,
        // StoredMemory is structurally a RecentMemory ({ type, content, importance }).
        recentMemories: searchMemory(memories, query, RECENT_MEMORY_COUNT),
      })
    },

    applyTurn(state: AmadeusState): RelationshipState {
      relationship = applyDelta(relationship, state.relationshipDelta)

      const kept = extractMemoryCandidates(state.memoryCandidates)
      if (kept.length > 0) {
        memories = appendMemories(memories, kept)
      }

      // Best-effort persistence. This runs inside pi's message_end listener,
      // where a throw would be re-surfaced to the user as a bogus "LLM error"
      // (the LLM actually succeeded) and leave the in-memory soul ahead of
      // disk. So a write failure (disk full, perms) is logged and swallowed;
      // the next successful turn re-persists the accumulated state.
      try {
        saveRelationship(relationshipPath, relationship)
        if (kept.length > 0) {
          saveMemories(memoryPath, memories)
        }
      }
      catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        process.stderr.write(`[soul] persistence failed: ${message}\n`)
      }

      return relationship
    },
  }
}
