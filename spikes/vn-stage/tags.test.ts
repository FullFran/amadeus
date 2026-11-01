import { describe, expect, it, vi } from 'vitest'

import { createTagFilter, filterStream } from './tags'

const STATE = '<amadeus_state>{"mood":"soft","relationshipDelta":{"trust":1,"affection":0,"familiarity":0,"annoyance":0},"memoryCandidates":[]}</amadeus_state>'

/** Feeds text in chunks and returns what became visible, chunk by chunk. */
function run(chunks: string[]) {
  const filter = createTagFilter()
  const visible = chunks.map(chunk => filter.push(chunk))
  visible.push(filter.flush())
  return { visible, text: visible.join(''), filter }
}

const chars = (text: string) => [...text]

describe('createTagFilter', () => {
  it('passes plain text through as it arrives', () => {
    expect(run(['Hola', ' mundo']).visible).toEqual(['Hola', ' mundo', ''])
  })

  it('removes the leading mood tag', () => {
    expect(run(['<mood>smug</mood>Hola']).text).toBe('Hola')
  })

  it('removes the state block at the end', () => {
    expect(run([`Hola${STATE}`]).text).toBe('Hola')
  })

  it('leaks nothing of a tag split across chunks, at any point', () => {
    const { visible, text } = run(chars(`<mood>smug</mood>Hola, mundo.${STATE}`))
    expect(text).toBe('Hola, mundo.')
    for (const chunk of visible)
      expect(chunk).not.toMatch(/[<>]/)
  })

  it('releases a < that turns out not to be one of our tags', () => {
    expect(run(chars('a < b y <moody> y <b>x</b>')).text).toBe('a < b y <moody> y <b>x</b>')
  })

  it('holds a possible tag only as long as it can still be one', () => {
    const { visible } = run(['a <mo', 'dern'])
    expect(visible[0]).toBe('a')
    expect(visible[1]).toBe(' <modern')
  })

  it('releases an unfinished tag prefix when the stream ends', () => {
    expect(run(['a <moo']).text).toBe('a <moo')
  })

  it('drops a state block that never closes, rather than showing it', () => {
    expect(run(['Hola<amadeus_state>{"mood":"so']).text).toBe('Hola')
  })

  it('drops an opening mood tag that never closes', () => {
    expect(run(['<mood>smu']).text).toBe('')
  })

  it('drops the whitespace a removed tag leaves at the start and at the end', () => {
    expect(run(['<mood>smug</mood>\n\nHola\n\n', STATE, '\n']).text).toBe('Hola')
  })

  it('keeps whitespace between words, even when it arrives alone', () => {
    expect(run(['Hola', ' ', 'mundo', '\n\n', 'adios']).text).toBe('Hola mundo\n\nadios')
  })

  it('removes a mood tag in the middle of the text too', () => {
    expect(run(['Hola <mood>soft</mood>mundo']).text).toBe('Hola mundo')
  })

  it('keeps the raw text for parsing the state', () => {
    const raw = `<mood>smug</mood>Hola${STATE}`
    expect(run(chars(raw)).filter.raw()).toBe(raw)
  })
})

describe('createTagFilter mood', () => {
  const moods = (chunks: string[]) => {
    const filter = createTagFilter()
    const seen: string[] = []
    for (const chunk of chunks) {
      filter.push(chunk)
      const mood = filter.mood()
      if (mood && seen.at(-1) !== mood)
        seen.push(mood)
    }
    return seen
  }

  it('knows the mood as soon as the leading tag closes', () => {
    const filter = createTagFilter()
    filter.push('<mood>smu')
    expect(filter.mood()).toBeNull()
    filter.push('g</mood>')
    expect(filter.mood()).toBe('smug')
  })

  it('falls back to the state block when the model skips the tag, before the block closes', () => {
    expect(moods(['Hola', '<amadeus_state>{"mood":"soft"', ',"rel'])).toEqual(['soft'])
  })

  it('has no mood for an unknown value', () => {
    expect(moods(['<mood>furious</mood>Hola'])).toEqual([])
  })
})

/** The fields of pi-ai's event stream that the filter relies on. */
function fakeStream() {
  const pushed: any[] = []
  return { pushed, push: (event: any) => pushed.push(event), end: vi.fn() }
}

function message(text: string) {
  return { role: 'assistant', content: [{ type: 'text', text }], stopReason: 'stop' }
}

/** What a provider emits for a text streamed in these chunks. */
function textEvents(chunks: string[], final: 'done' | 'error' = 'done') {
  const events: any[] = [{ type: 'start', partial: message('') }, { type: 'text_start', contentIndex: 0, partial: message('') }]
  let text = ''
  for (const delta of chunks) {
    text += delta
    events.push({ type: 'text_delta', contentIndex: 0, delta, partial: message(text) })
  }
  events.push({ type: 'text_end', contentIndex: 0, content: text, partial: message(text) })
  events.push(final === 'done'
    ? { type: 'done', reason: 'stop', message: message(text) }
    : { type: 'error', reason: 'error', error: message(text) })
  return events
}

async function* from(events: any[], fail?: Error) {
  yield* events
  if (fail)
    throw fail
}

async function filtered(events: any[], hooks = {}) {
  const stream = fakeStream()
  await filterStream(from(events), stream, hooks)
  return stream
}

describe('filterStream', () => {
  const chunks = ['<mood>sm', 'ug</mood>', 'Ho', 'la', STATE.slice(0, 20), STATE.slice(20)]

  it('sends only visible deltas', async () => {
    const { pushed } = await filtered(textEvents(chunks))
    expect(pushed.filter(e => e.type === 'text_delta').map(e => e.delta)).toEqual(['Ho', 'la'])
  })

  it('shows clean text in every partial, which is what Pi draws', async () => {
    const { pushed } = await filtered(textEvents(chunks))
    for (const event of pushed.filter(e => e.partial))
      expect(event.partial.content[0]?.text ?? '').not.toMatch(/[<>]/)
    expect(pushed.filter(e => e.type === 'text_delta').map(e => e.partial.content[0].text)).toEqual(['Ho', 'Hola'])
  })

  it('cleans the end of the block and the final message', async () => {
    const { pushed } = await filtered(textEvents(chunks))
    expect(pushed.find(e => e.type === 'text_end').content).toBe('Hola')
    expect(pushed.find(e => e.type === 'done').message.content[0].text).toBe('Hola')
  })

  it('cleans the message of a failed turn too', async () => {
    const { pushed } = await filtered(textEvents(chunks, 'error'))
    expect(pushed.find(e => e.type === 'error').error.content[0].text).toBe('Hola')
  })

  it('does not change the events of the provider', async () => {
    const events = textEvents(chunks)
    await filtered(events)
    expect(events.at(-1).message.content[0].text).toContain('<mood>')
  })

  it('passes thinking and tool events through untouched', async () => {
    const thinking = { type: 'thinking_delta', contentIndex: 0, delta: 'hm <mood>', partial: { role: 'assistant', content: [{ type: 'thinking', thinking: 'hm <mood>' }] } }
    const { pushed } = await filtered([thinking])
    expect(pushed[0].delta).toBe('hm <mood>')
    expect(pushed[0].partial.content[0].thinking).toBe('hm <mood>')
  })

  it('keeps tool calls in the final message', async () => {
    const call = { type: 'toolCall', id: 'x', name: 'read', arguments: {} }
    const events = [{ type: 'done', reason: 'toolUse', message: { role: 'assistant', content: [{ type: 'text', text: '<mood>soft</mood>Voy' }, call] } }]
    const { pushed } = await filtered(events)
    expect(pushed[0].message.content).toEqual([{ type: 'text', text: 'Voy' }, call])
  })

  it('filters each text block on its own', async () => {
    const two = { role: 'assistant', content: [{ type: 'text', text: '<mood>soft</mood>Uno' }, { type: 'text', text: 'Dos' }] }
    const { pushed } = await filtered([
      { type: 'text_delta', contentIndex: 0, delta: '<mood>soft</mood>Uno', partial: { role: 'assistant', content: [two.content[0]] } },
      { type: 'text_delta', contentIndex: 1, delta: 'Dos', partial: two },
    ])
    expect(pushed.map(e => e.delta)).toEqual(['Uno', 'Dos'])
    expect(pushed[1].partial.content.map((c: any) => c.text)).toEqual(['Uno', 'Dos'])
  })

  it('reports the mood once, and when it arrives, before the text after it', async () => {
    const onMood = vi.fn()
    const stream = fakeStream()
    const order: string[] = []
    const push = stream.push
    stream.push = (event: any) => {
      if (event.type === 'text_delta')
        order.push('text')
      push(event)
    }
    await filterStream(from(textEvents(chunks)), stream, { onMood: (mood: string) => {
      order.push('mood')
      onMood(mood)
    } })
    expect(onMood.mock.calls).toEqual([['smug']])
    expect(order.slice(0, 2)).toEqual(['mood', 'text'])
  })

  it('hands the raw text of the turn over at the end, once', async () => {
    const onRaw = vi.fn()
    await filtered(textEvents(chunks), { onRaw })
    expect(onRaw.mock.calls).toEqual([[chunks.join('')]])
  })

  it('ends the stream, and reports a provider failure as an error event', async () => {
    const stream = fakeStream()
    await filterStream(from([], new Error('boom')), stream, {}, { role: 'assistant', content: [], stopReason: 'error' })
    expect(stream.end).toHaveBeenCalledOnce()
    expect(stream.pushed[0].type).toBe('error')
    expect(stream.pushed[0].error.errorMessage).toBe('boom')
  })
})
