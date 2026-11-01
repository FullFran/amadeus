import type { Backend } from './kitty'
import type { Bitmap } from './sheet'
import type { Pose, StageEvent } from './stage'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'

import { join } from 'node:path'
import process from 'node:process'
import { getCellDimensions } from '@earendil-works/pi-tui'

import { chooseBackend, deleteImages, fitCells, MAX_ROWS, placeholderLines, placeImage, transmitImage, wrapForTmux } from './kitty'
import { framesFromSheet, renderHalfBlocks, scaleFrame } from './sheet'
import { createStage, ROW } from './stage'

/**
 * Spike: a familiard pet standing in a column beside Pi's chat.
 *
 * The column wraps the layout root the way Gentle Shell's sidebar does. That
 * reaches pi-tui internals with no documented contract, so a Pi upgrade can
 * break it; when it does, the chat stays and only the column is lost.
 */

const NODE = Symbol.for('@earendil-works/pi-tui/layout-node')
const MIN_COLUMNS = 100
const COLUMN_SHARE = 0.38
const TICK_MS = 50
const DEMO_STEP_MS = 3000
const POSES = Object.keys(ROW) as Pose[]
const FIRST_IMAGE_ID = 0x4A4D00
const MAX_FRAMES_PER_ROW = 16
const LAST_IMAGE_ID = FIRST_IMAGE_ID + 11 * MAX_FRAMES_PER_ROW
const inTmux = Boolean(process.env.TMUX)

function tmuxValue(args: string[]): string {
  try {
    return execFileSync('tmux', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  }
  catch {
    return ''
  }
}

function detectBackend(): Backend {
  const termName = inTmux ? tmuxValue(['display', '-p', '#{client_termname}']) : process.env.TERM ?? ''
  return chooseBackend({
    requested: process.env.AMADEUS_STAGE_RENDER,
    inTmux,
    termName: !inTmux && process.env.GHOSTTY_RESOURCES_DIR ? 'ghostty' : termName,
    passthrough: inTmux && tmuxValue(['show', '-pv', 'allow-passthrough']) !== 'off' && tmuxValue(['show', '-pv', 'allow-passthrough']) !== '',
  })
}

/** Pixel size of a terminal cell, which tmux knows and hides from programs inside it. */
function cellSize(): { width: number, height: number } {
  if (inTmux) {
    const [width, height] = tmuxValue(['display', '-p', '#{window_cell_width} #{window_cell_height}']).split(' ').map(Number)
    if (width && height)
      return { width, height }
  }
  const cell = getCellDimensions()
  return { width: cell.widthPx, height: cell.heightPx }
}

function loadPet(id: string): { name: string, frames: Map<number, Bitmap[]> } {
  const base = process.env.XDG_DATA_HOME || join(homedir(), '.local/share')
  const dir = join(base, 'familiard/pets', id)
  const manifest = JSON.parse(readFileSync(join(dir, 'pet.json'), 'utf8'))
  const path = join(dir, manifest.spritesheetPath)
  const [width, height] = execFileSync('identify', ['-format', '%w %h', path], { encoding: 'utf8' }).trim().split(' ').map(Number)
  const data = execFileSync('convert', [path, '-depth', '8', 'rgba:-'], { maxBuffer: 64 * 1024 * 1024 })
  return { name: manifest.displayName ?? id, frames: framesFromSheet({ width: width!, height: height!, data: new Uint8Array(data) }) }
}

export default function (pi: any) {
  let stage: ReturnType<typeof createStage> | undefined
  let pet: ReturnType<typeof loadPet> | undefined
  let tui: any
  let timers: ReturnType<typeof setInterval>[] = []
  let demo: ReturnType<typeof setTimeout> | undefined
  let lastKey = ''
  let backend: Backend = 'halfblock'
  const cache = new Map<string, { lines: string[], width: number }>()
  const uploaded = new Set<number>()
  const placed = new Set<string>()

  const send = (sequence: string) => tui.terminal.write(inTmux ? wrapForTmux(sequence) : sequence)

  function kittyArt(frame: Bitmap, id: number, width: number, rows: number) {
    const { cols, rows: height } = fitCells(frame, cellSize(), width, Math.min(rows - 2, MAX_ROWS))
    if (!uploaded.has(id)) {
      transmitImage(frame, id).forEach(send)
      uploaded.add(id)
    }
    const placement = `${id}:${cols}:${height}`
    if (!placed.has(placement)) {
      send(placeImage(id, cols, height))
      placed.add(placement)
    }
    return { lines: placeholderLines(id, cols, height), width: cols }
  }

  function halfBlockArt(frame: Bitmap, width: number, rows: number) {
    const scaled = scaleFrame(frame, (rows - 2) * 2, width)
    return { lines: renderHalfBlocks(scaled), width: scaled.width }
  }

  const fire = (event: StageEvent) => stage?.on(event, Date.now())

  function frameKey(now: number): string {
    if (!stage || !pet)
      return ''
    const row = stage.row()
    return `${row}:${stage.frameIndex(pet.frames.get(row)!.length, now)}`
  }

  const column = {
    invalidate() {},
    render(width: number): string[] {
      if (!stage || !pet || !tui)
        return []
      const row = stage.row()
      const list = pet.frames.get(row)!
      const index = stage.frameIndex(list.length, Date.now())
      const rows = tui.terminal.rows as number
      const key = `${row}:${index}:${width}:${rows}`
      let art = cache.get(key)
      if (!art) {
        art = backend === 'kitty'
          ? kittyArt(list[index]!, FIRST_IMAGE_ID + row * MAX_FRAMES_PER_ROW + index, width, rows)
          : halfBlockArt(list[index]!, width, rows)
        cache.set(key, art)
      }
      const indent = ' '.repeat(Math.max(0, Math.floor((width - art.width) / 2)))
      const caption = `${pet.name} · ${stage.pose()} · ${backend}`.slice(0, width)
      const blank = Math.max(0, rows - art.lines.length - 2)
      return [...Array.from({ length: blank }, () => ''), ...art.lines.map(line => indent + line), '', ' '.repeat(Math.max(0, Math.floor((width - caption.length) / 2))) + caption]
    },
  }

  function attach(): void {
    const root = tui?.layoutRoot
    if (!root || typeof root[NODE] !== 'function' || root.__amadeusStage)
      return
    const original = root[NODE]
    const chat = { render: () => [], invalidate() {}, [NODE]: () => original.call(root) }
    root[NODE] = () => {
      const columns = tui.terminal.columns as number
      if (tui.mode !== 'fullscreen' || columns < MIN_COLUMNS || !stage)
        return original.call(root)
      const width = Math.floor(columns * COLUMN_SHARE)
      return {
        type: 'hstack',
        gap: 1,
        align: 'stretch',
        entries: [
          { component: column, basis: width, grow: 0, shrink: 0, minSize: width },
          { component: chat, basis: 0, grow: 1, shrink: 1, minSize: 1 },
        ],
      }
    }
    root.__amadeusStage = true
    tui.requestRender()
  }

  function stop(): void {
    timers.forEach(clearInterval)
    timers = []
    if (demo)
      clearTimeout(demo)
    if (uploaded.size > 0)
      send(deleteImages(FIRST_IMAGE_ID, LAST_IMAGE_ID))
  }

  pi.on('session_start', async (_event: unknown, ctx: any) => {
    if (!ctx.hasUI)
      return
    try {
      pet = loadPet(process.env.AMADEUS_STAGE_PET || 'kurisu')
      stage = createStage(new Set(pet.frames.keys()))
      backend = detectBackend()
    }
    catch (error) {
      ctx.ui.notify(`stage: ${(error as Error).message}`, 'error')
      return
    }
    ctx.ui.setWidget('amadeus-stage', (host: any) => {
      tui = host
      return { render: () => [], invalidate() {} }
    })
    timers.push(setInterval(attach, 100))
    timers.push(setInterval(() => {
      const now = Date.now()
      stage?.tick(now)
      const key = frameKey(now)
      if (key !== lastKey) {
        lastKey = key
        tui?.requestRender()
      }
    }, TICK_MS))
    timers.forEach(timer => timer.unref())
  })

  pi.on('session_shutdown', async () => stop())
  pi.on('agent_start', async () => fire('agent_start'))
  pi.on('tool_execution_start', async () => fire('tool_start'))
  pi.on('tool_execution_end', async () => fire('tool_end'))
  pi.on('message_update', async (event: any) => {
    const type = event.assistantMessageEvent?.type
    if (type === 'text_delta' || type === 'thinking_delta')
      fire(type)
  })
  pi.on('agent_end', async (event: any) => {
    const last = event.messages?.at(-1)
    fire(last?.stopReason === 'error' || last?.stopReason === 'aborted' ? 'agent_error' : 'agent_end')
  })

  pi.registerCommand('stage', {
    description: 'Force a pose, play every pose with "demo", or release with "auto"',
    getArgumentCompletions: (prefix: string) => [...POSES, 'demo', 'auto'].filter(item => item.startsWith(prefix)).map(value => ({ value, label: value })),
    handler: async (args: string, ctx: any) => {
      const arg = args.trim()
      if (demo)
        clearTimeout(demo)
      if (arg === 'demo') {
        const play = (index: number) => {
          stage?.force(POSES[index], Date.now())
          demo = index + 1 < POSES.length
            ? setTimeout(() => play(index + 1), DEMO_STEP_MS)
            : setTimeout(() => stage?.force(undefined, Date.now()), DEMO_STEP_MS)
        }
        play(0)
      }
      else if (arg === 'auto' || arg === '') {
        stage?.force(undefined, Date.now())
      }
      else if (POSES.includes(arg as Pose)) {
        stage?.force(arg as Pose, Date.now())
      }
      else {
        ctx.ui.notify(`unknown pose: ${arg}`, 'error')
      }
    },
  })
}
