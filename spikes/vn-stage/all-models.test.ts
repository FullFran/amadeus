import { describe, expect, it, vi } from 'vitest'

import { filterAllModels as wrap } from './all-models'

/** An event stream with the shape of pi-ai's, so these tests need no Pi installed. */
function createStream() {
  const events: any[] = []
  let ended = false
  let wake = () => {}
  return {
    push(event: any) {
      events.push(event)
      wake()
    },
    end() {
      ended = true
      wake()
    },
    async* [Symbol.asyncIterator]() {
      for (let next = 0; ;) {
        if (next < events.length)
          yield events[next++]
        else if (ended)
          return
        else
          await new Promise<void>((resolve) => {
            wake = resolve
          })
      }
    },
  }
}

const filterAllModels = (registry: any, hooks: object) => wrap(registry, hooks, createStream)

const message = (text: string) => ({ role: 'assistant', content: [{ type: 'text', text }], stopReason: 'stop' })

async function* source(chunks: string[]) {
  let text = ''
  for (const delta of chunks) {
    text += delta
    yield { type: 'text_delta', contentIndex: 0, delta, partial: message(text) }
  }
  yield { type: 'done', reason: 'stop', message: message(text) }
}

const MODEL = { api: 'any-api', provider: 'any-provider', id: 'any-model' }

async function collect(stream: AsyncIterable<any>) {
  const events: any[] = []
  for await (const event of stream)
    events.push(event)
  return events
}

const registryWith = (streamSimple: (...args: any[]) => any): any => ({ runtime: { streamSimple } })

describe('filterAllModels', () => {
  it('hides the tags of a model it knows nothing about', async () => {
    const registry = registryWith(() => source(['<mood>smug</mood>Ho', 'la']))
    filterAllModels(registry, {})
    const events = await collect(registry.runtime.streamSimple(MODEL, {}, {}))
    expect(events.filter(e => e.type === 'text_delta').map(e => e.delta)).toEqual(['Ho', 'la'])
    expect(events.at(-1).message.content[0].text).toBe('Hola')
  })

  it('passes the arguments of the call to the original function', async () => {
    const original = vi.fn(() => source(['Hola']))
    const registry = registryWith(original)
    filterAllModels(registry, {})
    const context = { messages: [] }
    const options = { maxTokens: 5 }
    await collect(registry.runtime.streamSimple(MODEL, context, options))
    expect(original).toHaveBeenCalledWith(MODEL, context, options)
  })

  it('reports the turn through the hooks', async () => {
    const hooks = { onRequest: vi.fn(), onFirstText: vi.fn(), onMood: vi.fn(), onRaw: vi.fn() }
    const registry = registryWith(() => source(['<mood>smug</mood>', 'Hola']))
    filterAllModels(registry, hooks)
    await collect(registry.runtime.streamSimple(MODEL, {}, {}))
    expect(hooks.onRequest).toHaveBeenCalledOnce()
    expect(hooks.onFirstText).toHaveBeenCalledOnce()
    expect(hooks.onMood.mock.calls).toEqual([['smug']])
    expect(hooks.onRaw.mock.calls).toEqual([['<mood>smug</mood>Hola']])
  })

  it('accepts a function that returns its stream through a promise', async () => {
    const registry = registryWith(async () => source(['Hola']))
    filterAllModels(registry, {})
    const events = await collect(registry.runtime.streamSimple(MODEL, {}, {}))
    expect(events.at(-1).message.content[0].text).toBe('Hola')
  })

  it('turns a failed call into an error event naming the model', async () => {
    const registry = registryWith(async () => {
      throw new Error('no credentials')
    })
    filterAllModels(registry, {})
    const [event] = await collect(registry.runtime.streamSimple(MODEL, {}, {}))
    expect(event.type).toBe('error')
    expect(event.error.errorMessage).toBe('no credentials')
    expect(event.error.provider).toBe('any-provider')
  })

  it('wraps only once when a new session starts', async () => {
    const hooks = { onRequest: vi.fn() }
    const registry = registryWith(() => source(['Hola']))
    filterAllModels(registry, hooks)
    filterAllModels(registry, hooks)
    await collect(registry.runtime.streamSimple(MODEL, {}, {}))
    expect(hooks.onRequest).toHaveBeenCalledOnce()
  })

  it('says so when Pi no longer has the function it wraps', () => {
    expect(filterAllModels({}, {})).toBe(false)
    expect(filterAllModels(registryWith(() => source([])), {})).toBe(true)
  })
})
