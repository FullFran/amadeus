const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const SPEECH = '<mood>smug</mood>\n\nEl Amadeus System no es una simple grabación. Es una reconstrucción de mis recuerdos, y sí, puedo verte mientras hablas conmigo.\n\n'
const STATE = '<amadeus_state>{"mood":"soft","relationshipDelta":{"trust":1,"affection":0,"familiarity":0,"annoyance":0},"memoryCandidates":[]}</amadeus_state>'

/** Pieces of a few characters, so tags get split the way a real stream splits them. */
function pieces(text: string, size = 5): string[] {
  const out: string[] = []
  for (let i = 0; i < text.length; i += size)
    out.push(text.slice(i, i + size))
  return out
}

/**
 * A scripted model, so a real agent turn can be watched without spending
 * anything. It thinks, reads one file, then speaks slowly using the protocol.
 */
export async function* scriptedEvents(model: any, context: any): AsyncGenerator<any> {
  const output: any = {
    role: 'assistant',
    content: [],
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
    stopReason: 'stop',
    timestamp: Date.now(),
  }
  yield { type: 'start', partial: output }
  if (context.messages.at(-1)?.role !== 'toolResult') {
    await sleep(3000)
    const toolCall = { type: 'toolCall', id: 'call-1', name: 'read', arguments: { path: '/etc/hostname' } }
    output.content.push(toolCall)
    output.stopReason = 'toolUse'
    yield { type: 'toolcall_start', contentIndex: 0, partial: output }
    yield { type: 'toolcall_end', contentIndex: 0, toolCall, partial: output }
    yield { type: 'done', reason: 'toolUse', message: output }
    return
  }
  await sleep(1500)
  const block = { type: 'text', text: '' }
  output.content.push(block)
  yield { type: 'text_start', contentIndex: 0, partial: output }
  for (const delta of pieces(SPEECH + STATE)) {
    block.text += delta
    yield { type: 'text_delta', contentIndex: 0, delta, partial: output }
    await sleep(60)
  }
  yield { type: 'text_end', contentIndex: 0, content: block.text, partial: output }
  yield { type: 'done', reason: 'stop', message: output }
}
