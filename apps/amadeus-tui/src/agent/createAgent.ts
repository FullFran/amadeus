import { Agent } from '@earendil-works/pi-agent-core'
import { getModel } from '@earendil-works/pi-ai'

/**
 * Default model for Kurisu. Uses OpenCode Go hosted service (OpenAI-compatible
 * proxy at https://opencode.ai/zen/go/v1) — auth via OPENCODE_API_KEY env.
 *
 * Picked `deepseek-v4-flash` for first-token latency in companion mode.
 * Swap to `'kimi-k2.6'` or `'deepseek-v4-pro'` for higher reasoning quality
 * (e.g. when entering `coding` or `lab` mode in WP9).
 */
export const KURISU_MODEL = getModel('opencode-go', 'deepseek-v4-flash')

/**
 * Constructs a fresh Kurisu Agent. The `systemPrompt` is composed by the
 * {@link ../agent/soul!Soul} from the persisted relationship + relevant
 * memories, so the agent itself stays stateless about the persona — the caller
 * refreshes `agent.state.systemPrompt` before each turn for live continuity.
 */
export function createKurisuAgent(systemPrompt: string): Agent {
  return new Agent({
    initialState: {
      systemPrompt,
      model: KURISU_MODEL,
      // 'off' disables pi's extended-thinking request so deepseek-v4-flash
      // responds with shorter latency in companion mode. Bump to 'low'/'medium'
      // in 'lab'/'coding' modes when reasoning quality matters more than
      // first-token time.
      thinkingLevel: 'off',
    },
  })
}
