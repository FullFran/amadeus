export type Pose = 'idle' | 'thinking' | 'speaking' | 'tool' | 'celebrating' | 'failed' | 'waiting'
export type StageEvent = 'agent_start' | 'thinking_delta' | 'text_delta' | 'tool_start' | 'tool_end' | 'agent_end' | 'agent_error'

/** Rows of the Codex sheet that play each pose. */
export const ROW: Record<Pose, number> = {
  idle: 0,
  speaking: 3,
  celebrating: 4,
  failed: 5,
  waiting: 6,
  tool: 7,
  thinking: 8,
}

/** Frames per second by row, as in familiard's docs/pets.md; review and looks are not specified there. */
export const FPS: Record<number, number> = { 0: 3, 1: 8, 2: 8, 3: 3, 4: 8, 5: 3, 6: 4, 7: 8, 8: 4, 9: 4, 10: 4 }

const EPHEMERAL_MS = 3000

const NEXT: Record<StageEvent, Pose> = {
  agent_start: 'thinking',
  thinking_delta: 'thinking',
  text_delta: 'speaking',
  tool_start: 'tool',
  tool_end: 'thinking',
  agent_end: 'celebrating',
  agent_error: 'failed',
}

/** What the character is doing, derived from agent events. Time is always passed in. */
export function createStage(availableRows: ReadonlySet<number>) {
  let current: Pose = 'idle'
  let since = 0
  let forced: Pose | undefined

  function set(pose: Pose, now: number): void {
    if (pose === current)
      return
    current = pose
    since = now
  }

  const stage = {
    pose: (): Pose => forced ?? current,

    on(event: StageEvent, now: number): void {
      set(NEXT[event], now)
    },

    tick(now: number): void {
      if ((current === 'celebrating' || current === 'failed') && now - since >= EPHEMERAL_MS)
        set('idle', now)
    },

    force(pose: Pose | undefined, now: number): void {
      forced = pose
      since = now
    },

    row(): number {
      const row = ROW[stage.pose()]
      return availableRows.has(row) ? row : ROW.idle
    },

    frameIndex(length: number, now: number): number {
      const fps = FPS[stage.row()] ?? 3
      return Math.floor(Math.max(0, now - since) * fps / 1000) % length
    },
  }
  return stage
}
