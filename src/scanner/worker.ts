import type { DecodeRequest, DecodeResponse } from './engine'
import { decodePixels } from './decode'

interface WorkerScope {
  onmessage: ((event: MessageEvent<DecodeRequest>) => void) | null
  postMessage(message: DecodeResponse, transfer?: Transferable[]): void
}

const workerScope = self as unknown as WorkerScope

// Worker 内:ImageBitmap → 离屏画布取像素 → zxing-wasm 解码
workerScope.onmessage = async (event: MessageEvent<DecodeRequest>) => {
  const { id, bitmap } = event.data
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('无法创建离屏画布上下文')
    ctx.drawImage(bitmap, 0, 0)
    const pixels = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
    bitmap.close()
    const texts = await decodePixels(pixels)
    workerScope.postMessage({ id, ok: true, texts })
  } catch (err) {
    workerScope.postMessage({
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
