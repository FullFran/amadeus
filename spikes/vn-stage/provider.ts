import { createAssistantMessageEventStream, openAICompletionsApi } from '@earendil-works/pi-ai'

import { scriptedEvents } from './fake-provider'
import { filterStream } from './tags'

const ZERO_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }

/** pi-ai's own definition of this model in its opencode-go catalog. */
const DEEPSEEK = {
  id: 'deepseek-v4.1-flash',
  name: 'DeepSeek V4.1 Flash',
  reasoning: true,
  input: ['text', 'image'],
  cost: { input: 0.15, output: 0.6, cacheRead: 0.003, cacheWrite: 0 },
  contextWindow: 1000000,
  maxTokens: 384000,
}
const DEEPSEEK_UPSTREAM = {
  ...DEEPSEEK,
  api: 'openai-completions',
  provider: 'opencode-go',
  baseUrl: 'https://opencode.ai/inference/go/v1',
  compat: { supportsStore: false, supportsDeveloperRole: false, supportsStrictMode: true, maxTokensField: 'max_tokens', requiresReasoningContentOnAssistantMessages: true, thinkingFormat: 'deepseek' },
}

export interface TurnHooks {
  onRequest?: () => void
  onFirstText?: () => void
  onMood?: (mood: string) => void
  onRaw?: (raw: string) => void
}

/** Every model the stage talks to goes through the tag filter. */
function filtered(source: (model: any, context: any, options: any) => AsyncIterable<any>, hooks: TurnHooks) {
  return (model: any, context: any, options: any) => {
    const stream = createAssistantMessageEventStream()
    let sawText = false
    hooks.onRequest?.()
    const out = {
      push(event: any) {
        if (event.type === 'text_delta' && !sawText) {
          sawText = true
          hooks.onFirstText?.()
        }
        stream.push(event)
      },
      end: () => stream.end(),
    }
    const failure = { role: 'assistant', content: [], api: model.api, provider: model.provider, model: model.id, usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { ...ZERO_COST, total: 0 } }, stopReason: 'error', timestamp: Date.now() }
    void filterStream(source(model, context, options), out, hooks, failure)
    return stream
  }
}

export function registerProviders(pi: any, hooks: TurnHooks, withRealModel: boolean): void {
  pi.registerProvider('amadeus-fake', {
    baseUrl: 'http://localhost',
    apiKey: 'none',
    api: 'amadeus-fake-api',
    models: [{ id: 'scripted', name: 'Scripted', reasoning: false, input: ['text'], cost: ZERO_COST, contextWindow: 100000, maxTokens: 4096 }],
    streamSimple: filtered(scriptedEvents, hooks),
  })
  if (!withRealModel)
    return
  pi.registerProvider('amadeus-go', {
    baseUrl: DEEPSEEK_UPSTREAM.baseUrl,
    apiKey: '$OPENCODE_API_KEY',
    api: 'amadeus-go-api',
    models: [DEEPSEEK],
    streamSimple: filtered((_model, context, options) => openAICompletionsApi().streamSimple(DEEPSEEK_UPSTREAM as any, context, options), hooks),
  })
}
