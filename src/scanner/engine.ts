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
}

export interface DecodeRequest {
  id: number
  bitmap: ImageBitmap
}

export type DecodeResponse =
  | { id: number; ok: true; texts: string[] }
  | { id: number; ok: false; error: string }

export function createEngine(deps: EngineDeps = {}): DecodeEngine {
  const worker = (deps.workerFactory ?? (() => new DecodeWorker()))()
  const pending = new Map<number, { resolve: (texts: string[]) => void; reject: (error: Error) => void }>()
  let nextId = 0

  worker.onmessage = (event: MessageEvent<DecodeResponse>) => {
    const message = event.data
    const task = pending.get(message.id)
    if (!task) return
    pending.delete(message.id)
    if (message.ok) task.resolve(message.texts)
    else task.reject(new Error(message.error))
  }

  return {
    decode(bitmap) {
      const id = ++nextId
      return new Promise<string[]>((resolve, reject) => {
        pending.set(id, { resolve, reject })
        // 转移 bitmap 所有权,零拷贝交给 Worker
        worker.postMessage({ id, bitmap }, [bitmap])
      })
    },
    dispose() {
      worker.terminate()
      for (const task of pending.values()) task.reject(new Error('engine disposed'))
      pending.clear()
    },
  }
}
