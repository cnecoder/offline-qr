// 诊断日志(FR-10):人类可读时间戳,精确到毫秒。
// 桌面形态:console + 批量写入 Rust 日志文件(append_log);浏览器形态:仅 console。

const buffer: string[] = []
let flushTimer: number | undefined
let tauriMode: boolean | null = null

function tauri(): boolean {
  if (tauriMode === null) tauriMode = '__TAURI_INTERNALS__' in window
  return tauriMode
}

function pad(n: number, w = 2): string {
  return String(n).padStart(w, '0')
}

export function timestamp(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
}

export function log(scope: string, message: string): void {
  const line = `[${timestamp()}][${scope}] ${message}`
  console.info(line)
  if (!tauri()) return
  buffer.push(line)
  // 缓冲上限:避免写入失败时无限膨胀
  if (buffer.length > 400) buffer.splice(0, buffer.length - 400)
  scheduleFlush()
}

function scheduleFlush(): void {
  if (flushTimer !== undefined) return
  flushTimer = window.setTimeout(flush, 800)
}

async function flush(): Promise<void> {
  flushTimer = undefined
  if (buffer.length === 0) return
  const lines = buffer.splice(0, buffer.length)
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('append_log', { lines })
  } catch {
    // 日志写入失败静默降级(FR-10.3)
  }
}
