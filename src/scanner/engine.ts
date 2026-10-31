import DecodeWorker from './worker?worker&inline'

export interface DecodeEngine {
  /** 解码一张位图,返回其中全部 QR 码文本 */
  decode(bitmap: ImageBitmap): Promise<string[]>
  /** 终止 Worker 并拒绝所有未完成请求 */
  dispose(): void
}

export interface EngineDeps {
  /** 测试可注入假 Worker;默认创建内联 Worker */
  workerFactory?: () => Worker
  /**
   * 单张解码超时(毫秒),默认 8000:超时后终止并重建 Worker,任务按失败落定,
   * 保证"识别中"状态一定会终结;0 = 关闭超时(测试用)。Worker 异常终止同样自动重建。
   */
  timeoutMs?: number
}

export interface DecodeRequest {
  id: number
  bitmap: ImageBitmap
}

export type DecodeResponse =
  | { id: number; ok: true; texts: string[] }
  | { id: number; ok: false; error: string }

interface PendingTask {
  resolve: (texts: string[]) => void
  reject: (error: Error) => void
  timer: number
}

export function createEngine(deps: EngineDeps = {}): DecodeEngine {
  const timeoutMs = deps.timeoutMs ?? 8000
  const pending = new Map<number, PendingTask>()
  let nextId = 0
  let worker: Worker | null = null

  function handleResponse(event: MessageEvent<DecodeResponse>): void {
    const message = event.data
    const task = pending.get(message.id)
    if (!task) return
    window.clearTimeout(task.timer)
    pending.delete(message.id)
    if (message.ok) task.resolve(message.texts)
    else task.reject(new Error(message.error))
  }

  function spawn(): Worker {
    const w = deps.workerFactory ? deps.workerFactory() : new DecodeWorker()
    w.onmessage = handleResponse
    // Worker 内部未捕获异常(如 WASM 异常终止)会让挂起任务永远不落定,必须兜底重建
    w.onerror = () => reset('识别引擎异常终止')
    return w
  }

  /** 终止当前 Worker 并重建:所有挂起任务按 reason 拒绝,后续任务在新 Worker 上执行 */
  function reset(reason: string): void {
    worker?.terminate()
    worker = spawn()
    for (const task of pending.values()) {
      window.clearTimeout(task.timer)
      task.reject(new Error(reason))
    }
    pending.clear()
  }

  worker = spawn()

  return {
    decode(bitmap) {
      if (!worker) return Promise.reject(new Error('引擎已销毁'))
      const id = ++nextId
      return new Promise<string[]>((resolve, reject) => {
        const task: PendingTask = { resolve, reject, timer: 0 }
        pending.set(id, task)
        // 转移 bitmap 所有权,零拷贝交给 Worker
        worker!.postMessage({ id, bitmap }, [bitmap])
        if (timeoutMs > 0) {
          task.timer = window.setTimeout(() => {
            if (pending.has(id)) reset(`解码超时(>${Math.round(timeoutMs / 1000)}s),已停止`)
          }, timeoutMs)
        }
      })
    },
    dispose() {
      worker?.terminate()
      worker = null
      for (const task of pending.values()) {
        window.clearTimeout(task.timer)
        task.reject(new Error('引擎已销毁'))
      }
      pending.clear()
    },
  }
}
