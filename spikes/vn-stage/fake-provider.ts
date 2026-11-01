/**
 * Spike only: a scripted model, so a real agent turn can be watched without
 * spending anything. It thinks, reads one file, then speaks slowly.
 */
import { createAssistantMessageEventStream } from '@earendil-works/pi-ai'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const SPEECH = 'El Amadeus System no es una simple grabación. Es una reconstrucción de mis recuerdos, y sí, puedo verte mientras hablas conmigo. '.repeat(2)

export default function (pi: any) {
  pi.registerProvider('fake', {
    baseUrl: 'http://localhost',
    apiKey: 'none',
    api: 'fake-api',
    models: [{ id: 'scripted', name: 'Scripted', reasoning: false, input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 100000, maxTokens: 4096 }],
    streamSimple(model: any, context: any) {
      const stream = createAssistantMessageEventStream()
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
      const afterTool = context.messages.at(-1)?.role === 'toolResult'
      void (async () => {
        stream.push({ type: 'start', partial: output })
        if (!afterTool) {
          await sleep(3000)
          const toolCall = { type: 'toolCall', id: 'call-1', name: 'read', arguments: { path: '/etc/hostname' } }
          output.content.push(toolCall)
          output.stopReason = 'toolUse'
          stream.push({ type: 'toolcall_start', contentIndex: 0, partial: output })
          stream.push({ type: 'toolcall_end', contentIndex: 0, toolCall, partial: output })
          stream.push({ type: 'done', reason: 'toolUse', message: output })
          stream.end()
          return
        }
        await sleep(1500)
        const block = { type: 'text', text: '' }
        output.content.push(block)
        stream.push({ type: 'text_start', contentIndex: 0, partial: output })
        for (const word of SPEECH.split(' ')) {
          const delta = `${word} `
          block.text += delta
          stream.push({ type: 'text_delta', contentIndex: 0, delta, partial: output })
          await sleep(180)
        }
        stream.push({ type: 'text_end', contentIndex: 0, content: block.text, partial: output })
        stream.push({ type: 'done', reason: 'stop', message: output })
        stream.end()
      })()
      return stream
    },
  })
}
