import type { RelationshipState } from '@amadeus/contracts'

import { buildSystemPrompt } from '@amadeus/character'
import { Agent } from '@earendil-works/pi-agent-core'
import { getModel } from '@earendil-works/pi-ai'

/**
 * Default model for Kurisu. Uses OpenCode Go hosted service (OpenAI-compatible
 * proxy at https://opencode.ai/zen/go/v1) — auth via OPENCODE_API_KEY env.
 *
 * To switch models, see the `opencode-go` block in pi-ai's MODELS registry
 * (e.g. `'glm-5.1'`, `'deepseek-v4-pro'`, `'kimi-k2.5'`).
 */
export const KURISU_MODEL = getModel('opencode-go', 'kimi-k2.6')

const INITIAL_RELATIONSHIP: RelationshipState = {
  trust: 10,
  affection: 5,
  familiarity: 3,
  annoyance: 0,
  stage: 'stranger',
}

/**
 * Constructs a fresh Kurisu Agent with the composed system prompt and the
 * default model. The agent does not yet have memory, mood resolution, or
 * relationship persistence — those come in WP7/WP8.
 */
export function createKurisuAgent(): Agent {
  return new Agent({
    initialState: {
      systemPrompt: buildSystemPrompt({
        mode: 'companion',
        relationshipState: INITIAL_RELATIONSHIP,
      }),
      model: KURISU_MODEL,
      // 'off' disables pi's extended-thinking request so Kimi responds with
      // shorter latency in companion mode. Bump to 'low'/'medium' in 'lab' or
      // 'coding' modes when reasoning quality matters more than first-token time.
      thinkingLevel: 'off',
    },
  })
}
