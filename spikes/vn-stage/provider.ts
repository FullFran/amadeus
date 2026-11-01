import { createAssistantMessageEventStream } from '@earendil-works/pi-ai'

import { scriptedEvents } from './fake-provider'

const ZERO_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }

/** A model with no network or credentials, for checking the stage with `run.sh --fake`. */
export function registerFakeProvider(pi: any): void {
  pi.registerProvider('amadeus-fake', {
    baseUrl: 'http://localhost',
    apiKey: 'none',
    api: 'amadeus-fake-api',
    models: [{ id: 'scripted', name: 'Scripted', reasoning: false, input: ['text'], cost: ZERO_COST, contextWindow: 100000, maxTokens: 4096 }],
    streamSimple: (model: any, context: any, options: any) => {
      const stream = createAssistantMessageEventStream()
      void (async () => {
        for await (const event of scriptedEvents(model, context, options))
          stream.push(event)
        stream.end()
      })()
      return stream
    },
  })
}
