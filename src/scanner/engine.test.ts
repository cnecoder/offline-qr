import { describe, expect, it } from 'vitest'
import { createEngine, type DecodeRequest, type DecodeResponse } from './engine'

class FakeWorker {
  onmessage: ((event: MessageEvent<DecodeResponse>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
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

  /** 模拟 Worker 内部未捕获异常 */
  fail(): void {
    this.onerror?.(new ErrorEvent('error', { message: 'worker crashed' }))
  }
}

function fakeEngine(
  respond: (request: DecodeRequest, reply: (response: DecodeResponse) => void) => void,
) {
  const created: FakeWorker[] = []
  const engine = createEngine({
    workerFactory: () => {
      const fake = new FakeWorker(respond)
      created.push(fake)
      return fake as unknown as Worker
    },
  })
  return { engine, created }
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
    const { engine, created } = fakeEngine(() => {
      // 不回复,保持请求挂起
    })
    const pending = engine.decode(ANY_BITMAP)
    engine.dispose()
    await expect(pending).rejects.toThrow('引擎已销毁')
    expect(created[0].terminated).toBe(true)
  })

  it('解码超时:任务失败落定,Worker 重建,后续任务不受影响', async () => {
    const created: FakeWorker[] = []
    const engine = createEngine({
      workerFactory: () => {
        const fake = new FakeWorker((_req, reply) => {
          // 第一个 Worker 不回复(模拟后台卡死);重建后的 Worker 正常响应
          if (created.length > 1) reply({ id: _req.id, ok: true, texts: ['recovered'] })
        })
        created.push(fake)
        return fake as unknown as Worker
      },
      timeoutMs: 30,
    })
    const stuck = engine.decode(ANY_BITMAP)
    await expect(stuck).rejects.toThrow(/解码超时/)
    expect(created).toHaveLength(2)
    expect(created[0].terminated).toBe(true)
    await expect(engine.decode(ANY_BITMAP)).resolves.toEqual(['recovered'])
    engine.dispose()
  })

  it('Worker 异常终止(onerror):挂起任务拒绝并自动重建', async () => {
    const { engine, created } = fakeEngine(() => {
      // 不回复
    })
    const pending = engine.decode(ANY_BITMAP)
    created[0].fail()
    await expect(pending).rejects.toThrow('识别引擎异常终止')
    // 引擎自动重建了新 Worker
    expect(created).toHaveLength(2)
    expect(created[1].terminated).toBe(false)
    engine.dispose()
  })
})
