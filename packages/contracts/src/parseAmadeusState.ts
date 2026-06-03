import type { AmadeusState } from './amadeusState.js'
import type { MemoryCandidate, MemoryType } from './memory.js'
import type { Mood } from './mood.js'

import type { RelationshipDelta } from './relationship.js'
import { errMessage } from './internal/errMessage.js'
import { isMemoryType } from './memory.js'
import { isMood } from './mood.js'

export type ParseError
  = | { kind: 'missing-block' }
    | { kind: 'invalid-json', message: string }
    | { kind: 'invalid-shape', field: string, message: string }

export type ParseResult
  = | { ok: true, state: AmadeusState }
    | { ok: false, error: ParseError }

type FieldResult<T>
  = | { ok: true, value: T }
    | { ok: false, error: ParseError }

const STATE_BLOCK_REGEX = /<amadeus_state>([\s\S]*?)<\/amadeus_state>/

const LEADING_MOOD_REGEX = /^\s*<mood>\s*([a-z]+)\s*<\/mood>/i

const DELTA_FIELDS = ['trust', 'affection', 'familiarity', 'annoyance'] as const

/**
 * Extracts the OPTIONAL leading `<mood>…</mood>` tag a response may emit as its
 * very first token, so the UI can react to the mood the instant the model
 * starts replying — before the full {@link AmadeusState} block arrives at the
 * tail (which is, by protocol, the LAST thing in the response).
 *
 * Use when:
 * - Subscribed to `message_update` to drive the portrait mid-stream.
 *
 * Returns the {@link Mood} when a COMPLETE, valid leading tag is present;
 * `null` while it is still streaming, absent, or an unknown value. Never throws.
 * The authoritative mood for persistence still comes from {@link parseAmadeusState}
 * at `message_end`.
 */
export function parseLeadingMood(text: string): Mood | null {
  const candidate = LEADING_MOOD_REGEX.exec(text)?.[1]?.toLowerCase()
  return candidate !== undefined && isMood(candidate) ? candidate : null
}

// The `mood` field inside an <amadeus_state> block — matched even before the
// block closes, so the mood is available the instant it streams in the tail.
const BLOCK_MOOD_REGEX = /<amadeus_state>[\s\S]*?"mood"\s*:\s*"([a-z]+)"/i

/**
 * Best-effort mood for live (mid-stream) portrait updates, robust to the model
 * skipping the leading `<mood>` tag: returns the leading-tag mood if present,
 * otherwise the `mood` field from a (possibly still-streaming) `<amadeus_state>`
 * block. `null` until a valid mood has actually streamed. Never throws.
 *
 * The authoritative end-of-turn mood still comes from {@link parseAmadeusState}.
 */
export function parseStreamingMood(text: string): Mood | null {
  const leading = parseLeadingMood(text)
  if (leading !== null) {
    return leading
  }
  const candidate = BLOCK_MOOD_REGEX.exec(text)?.[1]?.toLowerCase()
  return candidate !== undefined && isMood(candidate) ? candidate : null
}

/**
 * Extracts and validates the <amadeus_state> JSON block from an assistant
 * response. Tolerant of surrounding natural-language text and never throws.
 *
 * Use when:
 * - Subscribed to pi-agent-core's `message_end` event to update the runtime
 *   state from each Kurisu turn.
 * - Post-processing any text that may contain a state payload.
 *
 * Expects:
 * - Free-form text that MAY contain exactly one
 *   `<amadeus_state>...</amadeus_state>` block whose body is JSON conforming
 *   to {@link AmadeusState}.
 *
 * Returns:
 * - `{ ok: true, state }` on success.
 * - `{ ok: false, error }` with a specific {@link ParseError} on any failure.
 *   Never throws — callers can treat the result as data.
 */
export function parseAmadeusState(text: string): ParseResult {
  const match = STATE_BLOCK_REGEX.exec(text)
  const jsonText = match?.[1]
  if (jsonText === undefined) {
    return { ok: false, error: { kind: 'missing-block' } }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText.trim())
  }
  catch (error) {
    return { ok: false, error: { kind: 'invalid-json', message: errMessage(error) } }
  }

  return validateState(parsed)
}

function validateState(raw: unknown): ParseResult {
  if (typeof raw !== 'object' || raw === null) {
    return invalidShape('root', 'expected object')
  }

  const obj = raw as Record<string, unknown>

  if (!isMood(obj.mood)) {
    return invalidShape('mood', `invalid mood: ${String(obj.mood)}`)
  }

  const delta = validateRelationshipDelta(obj.relationshipDelta)
  if (!delta.ok) {
    return delta
  }

  const candidates = validateMemoryCandidates(obj.memoryCandidates)
  if (!candidates.ok) {
    return candidates
  }

  return {
    ok: true,
    state: {
      mood: obj.mood,
      relationshipDelta: delta.value,
      memoryCandidates: candidates.value,
    },
  }
}

function validateRelationshipDelta(raw: unknown): FieldResult<RelationshipDelta> {
  if (typeof raw !== 'object' || raw === null) {
    return invalidShape('relationshipDelta', 'expected object')
  }

  const obj = raw as Record<string, unknown>
  const out = { trust: 0, affection: 0, familiarity: 0, annoyance: 0 }

  for (const field of DELTA_FIELDS) {
    const value = obj[field]
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return invalidShape(`relationshipDelta.${field}`, 'expected finite number')
    }
    out[field] = value
  }

  return { ok: true, value: out }
}

function validateMemoryCandidates(raw: unknown): FieldResult<MemoryCandidate[]> {
  if (!Array.isArray(raw)) {
    return invalidShape('memoryCandidates', 'expected array')
  }

  const candidates: MemoryCandidate[] = []
  for (let i = 0; i < raw.length; i++) {
    const validated = validateMemoryCandidate(raw[i], i)
    if (!validated.ok) {
      return validated
    }
    candidates.push(validated.value)
  }

  return { ok: true, value: candidates }
}

function validateMemoryCandidate(raw: unknown, index: number): FieldResult<MemoryCandidate> {
  const path = `memoryCandidates[${index}]`

  if (typeof raw !== 'object' || raw === null) {
    return invalidShape(path, 'expected object')
  }

  const obj = raw as Record<string, unknown>

  if (!isMemoryType(obj.type)) {
    return invalidShape(`${path}.type`, `invalid memory type: ${String(obj.type)}`)
  }

  if (typeof obj.content !== 'string' || obj.content.length === 0) {
    return invalidShape(`${path}.content`, 'expected non-empty string')
  }

  if (typeof obj.importance !== 'number' || !Number.isFinite(obj.importance)) {
    return invalidShape(`${path}.importance`, 'expected finite number')
  }

  return {
    ok: true,
    value: {
      type: obj.type as MemoryType,
      content: obj.content,
      importance: obj.importance,
    },
  }
}

function invalidShape(field: string, message: string): { ok: false, error: ParseError } {
  return { ok: false, error: { kind: 'invalid-shape', field, message } }
}
