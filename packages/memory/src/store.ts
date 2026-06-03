import type { MemoryType } from '@amadeus/contracts'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

import { dirname } from 'node:path'
import { isMemoryType } from '@amadeus/contracts'

/**
 * A memory that has been persisted to the store. Structurally a superset of
 * the character package's `RecentMemory` ({ type, content, importance }), so a
 * `StoredMemory[]` is directly assignable to a `RecentMemory[]` without this
 * package depending on `@amadeus/character`.
 */
export interface StoredMemory {
  id: string
  type: MemoryType
  content: string
  importance: number
  /** ISO 8601 timestamp of when the memory was first stored. */
  createdAt: string
}

/**
 * Narrow an unknown value to a structurally-valid {@link StoredMemory}. Used
 * defensively when loading from disk so that malformed entries are dropped
 * rather than poisoning the in-memory store.
 */
export function isStoredMemory(value: unknown): value is StoredMemory {
  if (typeof value !== 'object' || value === null)
    return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string'
    && isMemoryType(v.type)
    && typeof v.content === 'string'
    && v.content.length > 0
    && typeof v.importance === 'number'
    && Number.isFinite(v.importance)
    && typeof v.createdAt === 'string'
  )
}

/**
 * Read and parse the JSON array of memories at `filePath`.
 *
 * Never throws: on a missing file, unreadable file, malformed JSON, or
 * non-array content it returns `[]`. Shape-invalid entries are filtered out
 * defensively so a partially-corrupt file still yields its valid memories.
 */
export function loadMemories(filePath: string): StoredMemory[] {
  let raw: string
  try {
    raw = readFileSync(filePath, 'utf8')
  }
  catch {
    return []
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  }
  catch {
    return []
  }

  if (!Array.isArray(parsed))
    return []

  return parsed.filter(isStoredMemory)
}

/**
 * Persist `memories` to `filePath` as pretty (2-space) JSON, creating any
 * missing parent directories.
 */
export function saveMemories(filePath: string, memories: readonly StoredMemory[]): void {
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, `${JSON.stringify(memories, null, 2)}\n`, 'utf8')
}
