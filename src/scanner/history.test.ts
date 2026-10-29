import { describe, expect, it } from 'vitest'
import { createHistoryStore, type StorageLike } from './history'

function fakeStorage(initial: Record<string, string> = {}): StorageLike & { dump(): Record<string, string> } {
  const map = new Map(Object.entries(initial))
  return {
    getItem: key => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    dump: () => Object.fromEntries(map),
  }
}

describe('createHistoryStore', () => {
  it('add 新增并置顶', () => {
    const store = createHistoryStore({ storage: fakeStorage(), now: () => 1000 })
    store.add('a')
    store.add('b')
    expect(store.all().map(it => it.text)).toEqual(['b', 'a'])
    expect(store.all()[0].at).toBe(1000)
  })

  it('重复文本去重置顶并刷新时间', () => {
    let clock = 1000
    const store = createHistoryStore({ storage: fakeStorage(), now: () => clock })
    store.add('a')
    clock = 2000
    store.add('b')
    clock = 3000
    store.add('a')
    expect(store.all().map(it => it.text)).toEqual(['a', 'b'])
    expect(store.all()[0].at).toBe(3000)
    expect(store.all()).toHaveLength(2)
  })

  it('超过上限淘汰最旧条目', () => {
    let clock = 0
    const store = createHistoryStore({ storage: fakeStorage(), cap: 3, now: () => ++clock })
    for (const text of ['a', 'b', 'c', 'd']) store.add(text)
    expect(store.all().map(it => it.text)).toEqual(['d', 'c', 'b'])
  })

  it('clear 清空并持久化', () => {
    const storage = fakeStorage()
    const store = createHistoryStore({ storage, now: () => 1 })
    store.add('a')
    store.clear()
    expect(store.all()).toEqual([])
    expect(JSON.parse(storage.dump()['qr.history.v1'] ?? '[]')).toEqual([])
  })

  it('存储内容损坏时返回空列表而非抛错', () => {
    const store = createHistoryStore({ storage: fakeStorage({ 'qr.history.v1': 'not-json{{' }) })
    expect(store.all()).toEqual([])
  })

  it('结构非法的条目被过滤', () => {
    const bad = JSON.stringify([{ text: 'ok', at: 1 }, { foo: 1 }, null, { text: 42, at: 2 }])
    const store = createHistoryStore({ storage: fakeStorage({ 'qr.history.v1': bad }) })
    expect(store.all()).toEqual([{ text: 'ok', at: 1 }])
  })

  it('setItem 抛错时不影响内存外状态(add 正常返回)', () => {
    const storage: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota')
      },
    }
    const store = createHistoryStore({ storage, now: () => 1 })
    expect(store.add('a')).toEqual([{ text: 'a', at: 1 }])
  })
})
