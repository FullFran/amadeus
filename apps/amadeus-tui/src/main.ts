import { stdin, stdout } from 'node:process'
import { createInterface } from 'node:readline/promises'

import { attachStateHooks } from './agent/attachStateHooks.js'
import { createKurisuAgent } from './agent/createAgent.js'
import { assertApiKey } from './config/env.js'

async function main(): Promise<void> {
  assertApiKey()

  const agent = createKurisuAgent()
  const detach = attachStateHooks(agent)

  const rl = createInterface({ input: stdin, output: stdout })

  let exiting = false
  const shutdown = async (code: number): Promise<void> => {
    if (exiting) {
      return
    }
    exiting = true
    agent.abort()
    detach()
    rl.close()
    await agent.waitForIdle().catch(() => {})
    process.exit(code)
  }
  process.on('SIGINT', () => { void shutdown(0) })
  process.on('SIGTERM', () => { void shutdown(0) })

  process.stdout.write('AMADEUS — El Psy Kongroo. Type /quit or Ctrl+C to exit.\n\n')

  while (!exiting) {
    let line: string
    try {
      line = await rl.question('> ')
    }
    catch {
      break
    }

    const trimmed = line.trim()
    if (trimmed === '') {
      continue
    }
    if (trimmed === '/quit') {
      break
    }

    try {
      await agent.prompt(trimmed)
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      process.stderr.write(`[error] ${message}\n`)
    }
  }

  await shutdown(0)
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`[fatal] ${message}\n`)
  process.exit(1)
})
