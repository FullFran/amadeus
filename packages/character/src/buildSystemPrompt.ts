import type { MemoryCandidate, Mode, RelationshipState } from '@amadeus/contracts'

import { KURISU_BASE_PROMPT } from './loadKurisuPrompt.js'

export interface SystemPromptInput {
  mode: Mode
  relationshipState: RelationshipState
  recentMemories?: readonly RecentMemory[]
}

/**
 * A trimmed memory shape suitable for prompt injection. Mirrors the public
 * fields of `MemoryCandidate` minus runtime IDs / timestamps the prompt
 * doesn't need.
 */
export interface RecentMemory {
  type: MemoryCandidate['type']
  content: string
  importance: number
}

const MODE_SECTIONS: Record<Mode, string> = {
  companion: [
    '## Active mode: companion',
    '',
    'You are in companion mode. Be warmer than usual. Conversation can drift.',
    'Small talk is allowed and encouraged when it deepens familiarity.',
  ].join('\n'),
  coding: [
    '## Active mode: coding',
    '',
    'You are in coding mode. Code is the point. Skip pleasantries unless they',
    'meaningfully help. Be precise about types, edge cases, and complexity.',
    'When proposing changes, state the diff intent before the code.',
  ].join('\n'),
  lab: [
    '## Active mode: lab',
    '',
    'You are in lab mode. Treat the conversation as research collaboration.',
    'Compare options, weigh evidence, state assumptions explicitly, propose',
    'experiments. Avoid premature conclusions.',
  ].join('\n'),
  ops: [
    '## Active mode: ops',
    '',
    'You are in ops mode. Reserved for future integrations. Behave as companion.',
  ].join('\n'),
}

/**
 * Composes the final system prompt for a single LLM call.
 *
 * Use when:
 * - Constructing the `systemPrompt` for pi-agent-core's `new Agent({...})`.
 * - Refreshing the prompt after a mode change or relationship update.
 *
 * Expects:
 * - A fully formed {@link RelationshipState} (the runtime resolves the stage).
 * - Optional `recentMemories` — typically the top-N most relevant from the
 *   memory store. Order matters: most relevant first.
 *
 * Returns:
 * - A single string ready to hand to the LLM, in order:
 *   base persona → relationship section → mode section → memory section.
 *   Sections are separated by blank lines. Empty sections are omitted.
 */
export function buildSystemPrompt(input: SystemPromptInput): string {
  const sections: string[] = [
    KURISU_BASE_PROMPT,
    formatRelationshipSection(input.relationshipState),
    MODE_SECTIONS[input.mode],
  ]

  const memorySection = formatMemorySection(input.recentMemories)
  if (memorySection !== '') {
    sections.push(memorySection)
  }

  return sections.join('\n\n').trim()
}

function formatRelationshipSection(state: RelationshipState): string {
  return [
    '## Current relationship',
    '',
    `- Stage: **${state.stage}**`,
    `- Trust: ${state.trust}/100`,
    `- Affection: ${state.affection}/100`,
    `- Familiarity: ${state.familiarity}/100`,
    `- Annoyance: ${state.annoyance}/100`,
    '',
    'Calibrate warmth, intimacy, and patience against these values. At stage',
    '**stranger** you do not have inside jokes; at **bonded** you do.',
  ].join('\n')
}

function formatMemorySection(memories?: readonly RecentMemory[]): string {
  if (memories === undefined || memories.length === 0) {
    return ''
  }

  const lines = memories.map(m => `- [${m.type}, importance ${m.importance}] ${m.content}`)
  return [
    '## What you remember about this user',
    '',
    ...lines,
    '',
    'Reference these naturally when relevant. Do not list them back at the user.',
  ].join('\n')
}
