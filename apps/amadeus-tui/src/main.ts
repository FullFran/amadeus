import { ProcessTerminal, TUI } from '@earendil-works/pi-tui'

import { attachStateHooks } from './agent/attachStateHooks.js'
import { createKurisuAgent } from './agent/createAgent.js'
import { createSoul } from './agent/soul.js'
import { assertApiKey, resolveDataDir } from './config/env.js'
import { ChatPane } from './ui/ChatPane.js'
import { Header } from './ui/Header.js'
import { InputBar } from './ui/InputBar.js'
import { composeAmadeusLayout } from './ui/layout.js'
import { createPortraitRenderer } from './ui/portraits/PortraitRenderer.js'
import { StatusHud } from './ui/StatusHud.js'
import { WaifuPortrait } from './ui/WaifuPortrait.js'

const CLOCK_TICK_MS = 60_000

/**
 * Rows reserved for everything that is NOT the ChatPane, used to compute the
 * pane's max height so the layout stays "phone-shaped" (waifu pinned, chat
 * scrolls inside its allocation). Adjust together with the PhoneFrame padding
 * if those change.
 */
const RESERVED_ROWS_HEADER = 1
const RESERVED_ROWS_STATUS = 1 // StatusHud vitals strip under the portrait
const RESERVED_ROWS_INPUT = 3 // editor border + at least one input row
const RESERVED_ROWS_FRAME_PADDING = 4 // PhoneFrame paddingY=1 (top+bottom) + a couple of inter-component blanks
const MIN_CHAT_ROWS = 3

async function main(): Promise<void> {
  assertApiKey()

  const terminal = new ProcessTerminal()
  const tui = new TUI(terminal, true)
  const soul = createSoul(resolveDataDir())
  const agent = createKurisuAgent(soul.composePrompt(''))
  const header = new Header(soul.mode, 'idle')
  const chatPane = new ChatPane()
  const { renderer: portraitRenderer, tag: portraitTag } = createPortraitRenderer()
  const portrait = new WaifuPortrait(portraitRenderer, 'neutral')
  const statusHud = new StatusHud(soul.relationship())

  let exiting = false
  let busy = false
  let clockTimer: NodeJS.Timeout | undefined
  let detachHooks: (() => void) | undefined

  const shutdown = async (code: number): Promise<void> => {
    if (exiting) {
      return
    }
    exiting = true
    if (clockTimer !== undefined) {
      clearInterval(clockTimer)
    }
    process.stdout.removeListener('resize', onResize)
    portrait.stopAnimation()
    agent.abort()
    detachHooks?.()
    tui.stop()
    await agent.waitForIdle().catch(() => {})
    process.exit(code)
  }

  const inputBar = new InputBar(tui, async (text) => {
    if (text === '/quit' || text === '/exit') {
      void shutdown(0)
      return
    }
    if (busy) {
      // A run is already streaming. pi's `agent.prompt` would throw
      // "Agent is already processing" and the message would be silently lost,
      // so we hold the turn instead of painting it and dropping it.
      chatPane.appendSystemNotice('Esperá — todavía estoy pensando…')
      tui.requestRender()
      return
    }
    busy = true
    chatPane.appendUserTurn(text)
    header.setStatus('thinking')
    tui.requestRender()
    try {
      // Recompose the prompt with the live relationship + memories relevant to
      // THIS message so continuity updates mid-session, not only on restart.
      agent.state.systemPrompt = soul.composePrompt(text)
      await agent.prompt(text)
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      chatPane.appendSystemNotice(`prompt error: ${message}`)
      header.setStatus('error')
      tui.requestRender()
    }
    finally {
      busy = false
    }
  })

  detachHooks = attachStateHooks(agent, { chatPane, header, portrait, statusHud, tui, soul })

  tui.addChild(composeAmadeusLayout(header, portrait, statusHud, chatPane, inputBar))
  tui.setFocus(inputBar)

  chatPane.appendSystemNotice(`AMADEUS — El Psy Kongroo. \`/quit\` para salir. _portrait: ${portraitTag}_`)

  const recomputeChatRows = (): void => {
    const reserved
      = RESERVED_ROWS_HEADER
        + portraitRenderer.expectedHeight
        + RESERVED_ROWS_STATUS
        + RESERVED_ROWS_INPUT
        + RESERVED_ROWS_FRAME_PADDING
    const available = terminal.rows - reserved
    chatPane.setMaxRows(Math.max(MIN_CHAT_ROWS, available))
  }
  recomputeChatRows()

  const onResize = (): void => {
    recomputeChatRows()
    tui.requestRender()
  }
  process.stdout.on('resize', onResize)

  tui.start()
  tui.requestRender()
  portrait.startAnimation(tui)

  clockTimer = setInterval(() => {
    header.tick()
    tui.requestRender()
  }, CLOCK_TICK_MS)

  process.on('SIGINT', () => { void shutdown(0) })
  process.on('SIGTERM', () => { void shutdown(0) })
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`[fatal] ${message}\n`)
  process.exit(1)
})
