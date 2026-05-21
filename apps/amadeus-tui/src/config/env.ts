import type { KnownProvider } from '@earendil-works/pi-ai'

import { getEnvApiKey } from '@earendil-works/pi-ai'

/** Default LLM provider for Amadeus. Resolvable models: see pi-ai's MODELS registry. */
export const AMADEUS_PROVIDER: KnownProvider = 'opencode-go'

/**
 * Map provider → env var name. Mirrors the relevant entries from pi-ai's
 * internal getApiKeyEnvVars (not exported by pi-ai). Only contains providers
 * Amadeus actually uses.
 */
const ENV_VAR_FOR_PROVIDER: Partial<Record<KnownProvider, string>> = {
  'opencode-go': 'OPENCODE_API_KEY',
  'anthropic': 'ANTHROPIC_API_KEY',
}

/**
 * Fails fast if no API key is configured for the given provider. pi-ai
 * auto-resolves keys from env (e.g. OPENCODE_API_KEY for opencode-go).
 * Run with `pnpm dev` — the script pre-loads `.env` from the monorepo root.
 */
export function assertApiKey(provider: KnownProvider = AMADEUS_PROVIDER): void {
  if (getEnvApiKey(provider) !== undefined) {
    return
  }

  const envVar = ENV_VAR_FOR_PROVIDER[provider] ?? `${provider.toUpperCase().replace(/-/g, '_')}_API_KEY`
  throw new Error(
    `No API key found for provider "${provider}". Set ${envVar} in your environment or in the .env file at the monorepo root.`,
  )
}
