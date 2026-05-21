export const MOODS = [
  'neutral',
  'thinking',
  'annoyed',
  'smug',
  'embarrassed',
  'soft',
  'serious',
] as const

export type Mood = typeof MOODS[number]

export function isMood(value: unknown): value is Mood {
  return typeof value === 'string' && (MOODS as readonly string[]).includes(value)
}
