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
    // 四周垫 24px 白色静区:应对选区贴近二维码、安静区被裁掉的情况
    const pad = 24
    const canvas = new OffscreenCanvas(bitmap.width + pad * 2, bitmap.height + pad * 2)
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('无法创建离屏画布上下文')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, pad, pad)
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
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
