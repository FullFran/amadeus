export const MODES = ['companion', 'coding', 'lab', 'ops'] as const

export type Mode = typeof MODES[number]

export function isMode(value: unknown): value is Mode {
  return typeof value === 'string' && (MODES as readonly string[]).includes(value)
}
