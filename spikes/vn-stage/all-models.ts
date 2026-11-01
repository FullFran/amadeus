import { filterStream } from './tags'

const ZERO_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
const WRAPPED = Symbol.for('amadeus/stage/filter-all-models')

export interface TurnHooks {
  onRequest?: () => void
  onFirstText?: () => void
  onMood?: (mood: string) => void
  onRaw?: (raw: string) => void
}

/** The part of pi-ai's event stream that the filter writes to and Pi reads from. */
export interface OutputStream extends AsyncIterable<any> {
  push: (event: any) => void
  end: () => void
}

type StreamSimple = (model: any, context: any, options: any) => unknown

/**
 * Puts the tag filter in front of every model Pi can use, whichever `/login`
 * enabled, because Pi draws from partials and a tag would show while it streams.
 *
 * Pi's agent streams through `modelRegistry.runtime.streamSimple`, a private
 * field with no documented contract. Returns false when a Pi upgrade removed it,
 * so the caller can say the tags will show instead of failing silently.
 */
export function filterAllModels(registry: any, hooks: TurnHooks, createStream: () => OutputStream): boolean {
  const runtime = registry?.runtime
  if (typeof runtime?.streamSimple !== 'function')
    return false
  if (runtime[WRAPPED])
    return true
  const original: StreamSimple = runtime.streamSimple.bind(runtime)
  runtime[WRAPPED] = true
  runtime.streamSimple = (model: any, context: any, options: any) => {
    const stream = createStream()
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
    const failure = {
      role: 'assistant',
      content: [],
      api: model.api,
      provider: model.provider,
      model: model.id,
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: ZERO_COST },
      stopReason: 'error',
      timestamp: Date.now(),
    }
    // Inside a generator, a call that fails reaches the filter as a failure of the stream.
    const source = (async function* () {
      yield* await original(model, context, options) as AsyncIterable<any>
    })()
    void filterStream(source, out, hooks, failure)
    return stream
  }
  return true
}
