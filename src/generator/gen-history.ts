import type { StorageLike } from '../scanner/history'
import { contentSummary, type GenContent } from './content'

export interface GenHistoryEntry {
  content: GenContent
  at: number
}

export interface GenHistoryStore {
  all(): GenHistoryEntry[]
  /** 新增;同内容(JSON 相等)去重置顶并刷新时间;超限淘汰最旧 */
  add(content: GenContent): GenHistoryEntry[]
  clear(): void
}

export interface GenHistoryDeps {
  storage: StorageLike
  key?: string
  cap?: number
  now?: () => number
}

export const GEN_HISTORY_KEY = 'qr.gen-history.v1'
export const GEN_HISTORY_CAP = 20

function entryKey(content: GenContent): string {
  return JSON.stringify(content)
}

/** 生成历史:结构化条目(可恢复表单),逻辑与识别历史一致但相互独立存储 */
export function createGenHistoryStore(deps: GenHistoryDeps): GenHistoryStore {
  const storage = deps.storage
  const key = deps.key ?? GEN_HISTORY_KEY
  const cap = deps.cap ?? GEN_HISTORY_CAP
  const now = deps.now ?? (() => Date.now())

  function load(): GenHistoryEntry[] {
    try {
      const raw = storage.getItem(key)
      const parsed: unknown = raw ? JSON.parse(raw) : []
      if (!Array.isArray(parsed)) return []
      return parsed.filter(
        (it): it is GenHistoryEntry =>
          typeof it === 'object' &&
          it !== null &&
          typeof (it as GenHistoryEntry).at === 'number' &&
          typeof (it as GenHistoryEntry).content === 'object' &&
          (it as GenHistoryEntry).content !== null,
      )
    } catch {
      return []
    }
  }

  function save(entries: GenHistoryEntry[]): void {
    try {
      storage.setItem(key, JSON.stringify(entries))
    } catch {
      // 存储不可用时静默降级
    }
  }

  return {
    all: load,
    add(content) {
      const keyOfContent = entryKey(content)
      const rest = load().filter(it => entryKey(it.content) !== keyOfContent)
      const next = [{ content, at: now() }, ...rest].slice(0, cap)
      save(next)
      return next
    },
    clear() {
      save([])
    },
  }
}

export { contentSummary }
