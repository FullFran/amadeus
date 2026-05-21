import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const moduleDir = dirname(fileURLToPath(import.meta.url))

/**
 * Path to the canonical Kurisu base prompt. Resolves relative to this module
 * so it works both from `src/` (vitest) and `dist/` (built). The build script
 * mirrors `src/prompts/` into `dist/prompts/`.
 */
export const KURISU_PROMPT_PATH: string = join(moduleDir, 'prompts', 'kurisu.system.md')

/**
 * Synchronously loads the Kurisu base prompt from disk. Read once at module
 * load so importers don't pay the cost per call.
 */
export const KURISU_BASE_PROMPT: string = readFileSync(KURISU_PROMPT_PATH, 'utf-8')
