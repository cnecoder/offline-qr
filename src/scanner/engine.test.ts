import { describe, expect, it } from 'vitest'
import { createEngine, type DecodeRequest, type DecodeResponse } from './engine'

class FakeWorker {
  onmessage: ((event: MessageEvent<DecodeResponse>) => void) | null = null
  terminated = false

  constructor(
    private respond: (request: DecodeRequest, reply: (response: DecodeResponse) => void) => void,
  ) {}

  postMessage(message: DecodeRequest): void {
    this.respond(message, response => {
      queueMicrotask(() => this.onmessage?.(new MessageEvent('message', { data: response })))
    })
  }

  terminate(): void {
    this.terminated = true
  }
}

function fakeEngine(respond: (request: DecodeRequest, reply: (response: DecodeResponse) => void) => void) {
  const fake = new FakeWorker(respond)
  const engine = createEngine({ workerFactory: () => fake as unknown as Worker })
  return { engine, fake }
}

const ANY_BITMAP = {} as ImageBitmap

describe('createEngine(Worker 请求-响应封装)', () => {
  it('decode 返回 Worker 的解码结果', async () => {
    const { engine } = fakeEngine((req, reply) => reply({ id: req.id, ok: true, texts: ['hello'] }))
    await expect(engine.decode(ANY_BITMAP)).resolves.toEqual(['hello'])
    engine.dispose()
  })

  it('并发请求按 id 正确配对(响应乱序)', async () => {
    const { engine } = fakeEngine((req, reply) => {
      if (req.id === 1) setTimeout(() => reply({ id: 1, ok: true, texts: ['slow'] }), 20)
      else reply({ id: req.id, ok: true, texts: ['fast'] })
    })
    const [slow, fast] = await Promise.all([engine.decode(ANY_BITMAP), engine.decode(ANY_BITMAP)])
    expect(slow).toEqual(['slow'])
    expect(fast).toEqual(['fast'])
    engine.dispose()
  })

  it('Worker 报错时 decode 以错误拒绝', async () => {
    const { engine } = fakeEngine((req, reply) => reply({ id: req.id, ok: false, error: 'boom' }))
    await expect(engine.decode(ANY_BITMAP)).rejects.toThrow('boom')
    engine.dispose()
  })

  it('dispose 终止 Worker 并拒绝未完成请求', async () => {
    const { engine, fake } = fakeEngine(() => {
      // 不回复,保持请求挂起
    })
    const pending = engine.decode(ANY_BITMAP)
    engine.dispose()
    await expect(pending).rejects.toThrow('engine disposed')
    expect(fake.terminated).toBe(true)
  })
})
