import { describe, expect, it } from 'vitest'
import { createSerialQueue } from './queue'

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

describe('createSerialQueue', () => {
  it('按提交顺序串行执行(前慢后快也不插队)', async () => {
    const queue = createSerialQueue()
    const events: string[] = []
    const first = queue.add(async () => {
      events.push('a-start')
      await delay(20)
      events.push('a-end')
      return 'A'
    })
    const second = queue.add(async () => {
      events.push('b-start')
      events.push('b-end')
      return 'B'
    })
    const [a, b] = await Promise.all([first, second])
    expect(a).toBe('A')
    expect(b).toBe('B')
    expect(events).toEqual(['a-start', 'a-end', 'b-start', 'b-end'])
  })

  it('单个任务失败不阻断后续任务', async () => {
    const queue = createSerialQueue()
    const first = queue.add(async () => {
      throw new Error('boom')
    })
    const second = queue.add(async () => 'ok')
    await expect(first).rejects.toThrow('boom')
    await expect(second).resolves.toBe('ok')
  })

  it('onIdle 等待全部任务结束', async () => {
    const queue = createSerialQueue()
    let done = false
    queue.add(async () => {
      await delay(10)
      done = true
    })
    await queue.onIdle()
    expect(done).toBe(true)
  })
})
