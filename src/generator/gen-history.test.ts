import { describe, expect, it } from 'vitest'
import { createGenHistoryStore, type GenHistoryEntry } from './gen-history'
import type { StorageLike } from '../scanner/history'
import type { WifiContent } from './content'

function fakeStorage(initial: Record<string, string> = {}): StorageLike & { dump(): Record<string, string> } {
  const map = new Map(Object.entries(initial))
  return {
    getItem: key => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    dump: () => Object.fromEntries(map),
  }
}

const wifi: WifiContent = { kind: 'wifi', ssid: 'Net', password: 'p', encryption: 'WPA', hidden: false }

function wifiContent(ssid: string): WifiContent {
  return { ...wifi, ssid }
}

describe('createGenHistoryStore', () => {
  it('add 置顶并保留结构化内容', () => {
    let clock = 0
    const store = createGenHistoryStore({ storage: fakeStorage(), now: () => ++clock })
    store.add({ kind: 'text', text: 'a' })
    store.add(wifiContent('Net'))
    const entries = store.all()
    expect(entries).toHaveLength(2)
    expect(entries[0].content.kind).toBe('wifi')
    expect((entries[0].content as WifiContent).ssid).toBe('Net')
    expect(entries[0].at).toBe(2)
  })

  it('同内容(JSON 相等)去重置顶并刷新时间', () => {
    let clock = 0
    const store = createGenHistoryStore({ storage: fakeStorage(), now: () => ++clock })
    store.add(wifiContent('Net'))
    store.add({ kind: 'text', text: 'a' })
    store.add(wifiContent('Net'))
    const entries = store.all()
    expect(entries).toHaveLength(2)
    expect((entries[0].content as WifiContent).ssid).toBe('Net')
    expect(entries[0].at).toBe(3)
  })

  it('超过上限淘汰最旧', () => {
    let clock = 0
    const store = createGenHistoryStore({ storage: fakeStorage(), cap: 2, now: () => ++clock })
    store.add({ kind: 'text', text: 'a' })
    store.add({ kind: 'text', text: 'b' })
    store.add({ kind: 'text', text: 'c' })
    expect(store.all().map(it => (it.content as { text: string }).text)).toEqual(['c', 'b'])
  })

  it('clear 清空并持久化', () => {
    const storage = fakeStorage()
    const store = createGenHistoryStore({ storage, now: () => 1 })
    store.add({ kind: 'text', text: 'a' })
    store.clear()
    expect(store.all()).toEqual([])
    expect(JSON.parse(storage.dump()['qr.gen-history.v1'] ?? '[]')).toEqual([])
  })

  it('存储损坏或条目非法时容错', () => {
    const bad = JSON.stringify([{ content: { kind: 'text', text: 'ok' }, at: 1 }, { nope: true }, null])
    const store = createGenHistoryStore({ storage: fakeStorage({ 'qr.gen-history.v1': 'broken{{' }) })
    expect(store.all()).toEqual([])
    const store2 = createGenHistoryStore({ storage: fakeStorage({ 'qr.gen-history.v1': bad }) })
    expect(store2.all().map(it => it.content)).toEqual([{ kind: 'text', text: 'ok' }])
  })

  it('类型守卫:非法条目被过滤后仍可正常 add', () => {
    const store = createGenHistoryStore({ storage: fakeStorage(), now: () => 1 })
    const entries: GenHistoryEntry[] = store.add(wifiContent('Net'))
    expect(entries).toHaveLength(1)
  })
})
