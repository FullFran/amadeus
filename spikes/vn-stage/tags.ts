import { parseStreamingMood } from '../../packages/contracts/src/index'

const MOOD_OPEN = '<mood>'
const MOOD_CLOSE = '</mood>'
const STATE_OPEN = '<amadeus_state>'
const STATE_CLOSE = '</amadeus_state>'
const OPENERS = [MOOD_OPEN, STATE_OPEN]

/** How many characters at the end of `text` could still become one of the opening tags. */
function possibleTagLength(text: string): number {
  const longest = Math.max(...OPENERS.map(tag => tag.length)) - 1
  for (let length = Math.min(longest, text.length); length > 0; length--) {
    const tail = text.slice(-length)
    if (OPENERS.some(tag => tag.startsWith(tail)))
      return length
  }
  return 0
}

/**
 * Removes the state protocol from text that arrives in pieces. Nothing that may
 * still turn into a tag leaves the filter, and a tag that never closes is
 * dropped rather than shown, because what is inside it was never for the reader.
 */
export function createTagFilter() {
  let raw = ''
  let buffer = ''
  let closer: string | undefined
  let started = false
  let heldSpace = ''

  /** Whitespace waits for visible text after it, so tags leave no gaps at the edges. */
  function reveal(text: string): string {
    const body = text.trimEnd()
    const space = text.slice(body.length)
    if (!body) {
      heldSpace += started ? space : ''
      return ''
    }
    const out = started ? heldSpace + body : body.trimStart()
    started = true
    heldSpace = space
    return out
  }

  return {
    push(chunk: string): string {
      raw += chunk
      buffer += chunk
      let visible = ''
      while (buffer) {
        if (closer) {
          const end = buffer.indexOf(closer)
          if (end < 0)
            break
          buffer = buffer.slice(end + closer.length)
          closer = undefined
          continue
        }
        const mood = buffer.indexOf(MOOD_OPEN)
        const state = buffer.indexOf(STATE_OPEN)
        const isMood = mood >= 0 && (state < 0 || mood < state)
        const start = isMood ? mood : state
        if (start < 0) {
          const safe = buffer.length - possibleTagLength(buffer)
          visible += reveal(buffer.slice(0, safe))
          buffer = buffer.slice(safe)
          break
        }
        visible += reveal(buffer.slice(0, start))
        buffer = buffer.slice(start + (isMood ? MOOD_OPEN : STATE_OPEN).length)
        closer = isMood ? MOOD_CLOSE : STATE_CLOSE
      }
      return visible
    },

    /** The stream ended. An unfinished opening tag was only text; whatever is inside an open tag is dropped. */
    flush(): string {
      const rest = closer ? '' : buffer
      buffer = ''
      return rest ? reveal(rest) : ''
    },

    raw: () => raw,
    mood: () => parseStreamingMood(raw),
  }
}

interface Hooks {
  onMood?: (mood: string) => void
  onRaw?: (raw: string) => void
}

function cleanText(text: string): string {
  const filter = createTagFilter()
  return filter.push(text) + filter.flush()
}

/**
 * Forwards a provider's events to `stream` with the protocol removed from the
 * text blocks, which is what Pi draws and stores. The raw text goes to `onRaw`.
 * The provider's own objects are never changed.
 */
export async function filterStream(
  inner: AsyncIterable<any>,
  stream: { push: (event: any) => void, end: () => void },
  hooks: Hooks,
  failure: object = { role: 'assistant', content: [], stopReason: 'error' },
): Promise<void> {
  const filters = new Map<number, ReturnType<typeof createTagFilter>>()
  const visible = new Map<number, string>()
  let lastMood: string | null = null

  const filterOf = (index: number) => {
    let filter = filters.get(index)
    if (!filter) {
      filter = createTagFilter()
      filters.set(index, filter)
    }
    return filter
  }

  const cleanPartial = (partial: any) => partial && {
    ...partial,
    content: partial.content.map((block: any, index: number) =>
      block.type === 'text' ? { ...block, text: visible.get(index) ?? '' } : block),
  }

  const cleanFinal = (message: any) => ({
    ...message,
    content: message.content.map((block: any) => block.type === 'text' ? { ...block, text: cleanText(block.text) } : block),
  })

  const noteMood = (filter: ReturnType<typeof createTagFilter>) => {
    const mood = filter.mood()
    if (mood && mood !== lastMood) {
      lastMood = mood
      hooks.onMood?.(mood)
    }
  }

  try {
    for await (const event of inner) {
      if (event.type === 'text_delta') {
        const filter = filterOf(event.contentIndex)
        const delta = filter.push(event.delta)
        noteMood(filter)
        if (delta) {
          visible.set(event.contentIndex, (visible.get(event.contentIndex) ?? '') + delta)
          stream.push({ ...event, delta, partial: cleanPartial(event.partial) })
        }
      }
      else if (event.type === 'text_end') {
        const tail = filterOf(event.contentIndex).flush()
        const text = (visible.get(event.contentIndex) ?? '') + tail
        visible.set(event.contentIndex, text)
        const partial = cleanPartial(event.partial)
        if (tail)
          stream.push({ type: 'text_delta', contentIndex: event.contentIndex, delta: tail, partial })
        stream.push({ ...event, content: text, partial })
      }
      else if (event.type === 'done') {
        hooks.onRaw?.(event.message.content.filter((block: any) => block.type === 'text').map((block: any) => block.text).join(''))
        stream.push({ ...event, message: cleanFinal(event.message) })
      }
      else if (event.type === 'error') {
        stream.push({ ...event, error: cleanFinal(event.error) })
      }
      else {
        stream.push(event.partial ? { ...event, partial: cleanPartial(event.partial) } : event)
      }
    }
  }
  catch (error) {
    stream.push({ type: 'error', reason: 'error', error: { ...failure, errorMessage: (error as Error).message } })
  }
  stream.end()
}
