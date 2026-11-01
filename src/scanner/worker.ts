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
  const srcW = bitmap.width
  const srcH = bitmap.height
  try {
    // 四周垫 24px 白色静区:应对选区贴近二维码、安静区被裁掉的情况
    const pad = 24
    const canvas = new OffscreenCanvas(srcW + pad * 2, srcH + pad * 2)
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('无法创建离屏画布上下文')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, pad, pad)
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
    bitmap.close()
    let texts = await decodePixels(pixels)
    // 大幅放大的二维码(查看器高倍缩放等)模块过大过软,缩半重试一次
    if (texts.length === 0 && Math.max(srcW, srcH) > 600) {
      const w2 = Math.max(1, Math.floor(canvas.width / 2))
      const h2 = Math.max(1, Math.floor(canvas.height / 2))
      const small = new OffscreenCanvas(w2, h2)
      const sctx = small.getContext('2d', { willReadFrequently: true })
      if (sctx) {
        sctx.fillStyle = '#ffffff'
        sctx.fillRect(0, 0, w2, h2)
        sctx.drawImage(canvas, 0, 0, w2, h2)
        texts = await decodePixels(sctx.getImageData(0, 0, w2, h2))
      }
    }
    workerScope.postMessage({ id, ok: true, texts })
  } catch (err) {
    workerScope.postMessage({
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
