import { ProcessTerminal, TUI } from '@earendil-works/pi-tui'

import { attachStateHooks } from './agent/attachStateHooks.js'
import { createKurisuAgent } from './agent/createAgent.js'
import { assertApiKey } from './config/env.js'
import { ChatPane } from './ui/ChatPane.js'
import { Header } from './ui/Header.js'
import { InputBar } from './ui/InputBar.js'
import { composeAmadeusLayout } from './ui/layout.js'

const CLOCK_TICK_MS = 60_000

async function main(): Promise<void> {
  assertApiKey()

  const terminal = new ProcessTerminal()
  const tui = new TUI(terminal, true)
  const agent = createKurisuAgent()
  const header = new Header('companion', 'idle')
  const chatPane = new ChatPane()

  let exiting = false
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
    chatPane.appendUserTurn(text)
    header.setStatus('thinking')
    tui.requestRender()
    try {
      await agent.prompt(text)
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      chatPane.appendSystemNotice(`prompt error: ${message}`)
      header.setStatus('error')
      tui.requestRender()
    }
  })

  detachHooks = attachStateHooks(agent, { chatPane, header, tui })

  tui.addChild(composeAmadeusLayout(header, chatPane, inputBar))
  tui.setFocus(inputBar)

  chatPane.appendSystemNotice('AMADEUS — El Psy Kongroo. `/quit` para salir.')

  tui.start()
  tui.requestRender()

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
