import type { KnownProvider } from '@earendil-works/pi-ai'

import { homedir } from 'node:os'
import { join } from 'node:path'
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

/**
 * Where Amadeus persists the soul (relationship.json + memory.json).
 *
 * Resolves to a STABLE, launch-location-independent path so Kurisu remembers
 * you regardless of the directory you start her from (a cwd-relative store
 * would silently fork into a fresh, amnesiac soul on `pnpm start` or an
 * install run):
 *   1. `AMADEUS_DATA_DIR` if set (explicit override, e.g. a repo-local dir).
 *   2. `$XDG_DATA_HOME/amadeus` (XDG Base Directory spec).
 *   3. `~/.local/share/amadeus` (XDG default).
 */
export function resolveDataDir(): string {
  const override = process.env.AMADEUS_DATA_DIR
  if (override !== undefined && override !== '') {
    return override
  }
  const xdgDataHome = process.env.XDG_DATA_HOME
  const base = xdgDataHome !== undefined && xdgDataHome !== ''
    ? xdgDataHome
    : join(homedir(), '.local', 'share')
  return join(base, 'amadeus')
}
