export interface HistoryEntry {
  text: string
  at: number
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface HistoryStore {
  all(): HistoryEntry[]
  /** 新增一条;同文本去重置顶并刷新时间;超限淘汰最旧。返回更新后的全量列表 */
  add(text: string): HistoryEntry[]
  clear(): void
}

export interface HistoryDeps {
  storage: StorageLike
  key?: string
  cap?: number
  now?: () => number
}

export const HISTORY_KEY = 'qr.history.v1'
export const HISTORY_CAP = 20

/** 识别历史:纯逻辑,storage/时间/上限全部注入,便于测试 */
export function createHistoryStore(deps: HistoryDeps): HistoryStore {
  const storage = deps.storage
  const key = deps.key ?? HISTORY_KEY
  const cap = deps.cap ?? HISTORY_CAP
  const now = deps.now ?? (() => Date.now())

  function load(): HistoryEntry[] {
    try {
      const raw = storage.getItem(key)
      const parsed: unknown = raw ? JSON.parse(raw) : []
      if (!Array.isArray(parsed)) return []
      return parsed.filter(
        (it): it is HistoryEntry =>
          typeof it === 'object' &&
          it !== null &&
          typeof (it as HistoryEntry).text === 'string' &&
          typeof (it as HistoryEntry).at === 'number',
      )
    } catch {
      return []
    }
  }

  function save(entries: HistoryEntry[]): void {
    try {
      storage.setItem(key, JSON.stringify(entries))
    } catch {
      // 存储不可用(如隐私模式)时静默降级
    }
  }

  return {
    all: load,
    add(text) {
      const rest = load().filter(it => it.text !== text)
      const next = [{ text, at: now() }, ...rest].slice(0, cap)
      save(next)
      return next
    },
    clear() {
      save([])
    },
  }
}
