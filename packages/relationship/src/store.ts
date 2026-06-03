import type { RelationshipState } from '@amadeus/contracts'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

import { dirname } from 'node:path'

import { narrativeStage } from './narrativeStage.js'
import { INITIAL_RELATIONSHIP } from './state.js'

const DIM_MIN = 0
const DIM_MAX = 100

function clampDim(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value))
    return null
  if (value < DIM_MIN)
    return DIM_MIN
  if (value > DIM_MAX)
    return DIM_MAX
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Coerce arbitrary parsed JSON into a valid RelationshipState, or return null
 * if the four dimensions are not all present and numeric. The stage field on
 * disk is intentionally ignored and recomputed from the dims so a hand-edited
 * (or stale) file can never desync.
 */
function coerce(raw: unknown): RelationshipState | null {
  if (!isRecord(raw))
    return null
  const trust = clampDim(raw.trust)
  const affection = clampDim(raw.affection)
  const familiarity = clampDim(raw.familiarity)
  const annoyance = clampDim(raw.annoyance)
  if (trust === null || affection === null || familiarity === null || annoyance === null)
    return null
  return {
    trust,
    affection,
    familiarity,
    annoyance,
    stage: narrativeStage({ trust, affection, familiarity, annoyance }),
  }
}

/**
 * Load relationship state from disk.
 *
 * NEVER throws. On a missing file, unreadable file, malformed JSON, or
 * shape-invalid content it returns a fresh `structuredClone` of
 * INITIAL_RELATIONSHIP. On a valid-enough file the stage is recomputed from the
 * loaded dimensions (defensive against hand edits) and dims are clamped to
 * [0,100].
 */
export function loadRelationship(filePath: string): RelationshipState {
  let text: string
  try {
    text = readFileSync(filePath, 'utf8')
  }
  catch {
    return structuredClone(INITIAL_RELATIONSHIP)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  }
  catch {
    return structuredClone(INITIAL_RELATIONSHIP)
  }

  const coerced = coerce(parsed)
  if (coerced === null)
    return structuredClone(INITIAL_RELATIONSHIP)
  return coerced
}

/**
 * Persist relationship state to disk as pretty-printed (2-space) JSON. Creates
 * the parent directory chain if it does not exist.
 */
export function saveRelationship(filePath: string, state: RelationshipState): void {
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}
