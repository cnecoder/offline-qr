// E2E 样张生成:在 Node 侧用 qrcode 库构造 QR 矩阵,再以手写 PNG 编码器输出图片字节。
// 无需 canvas 依赖,可在任意 CI 环境运行。
import { deflateSync } from 'node:zlib'
import QRCode from 'qrcode'
import type { Page } from '@playwright/test'

/** 在页面内合成剪贴板粘贴事件(与真实 Ctrl+V 走同一处理路径) */
export async function pasteImage(page: Page, png: Buffer, name = 'shot.png'): Promise<void> {
  await page.evaluate(
    ({ base64, name }) => {
      const bin = atob(base64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      const dt = new DataTransfer()
      dt.items.add(new File([bytes], name, { type: 'image/png' }))
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }))
    },
    { base64: png.toString('base64'), name },
  )
}

const CRC_TABLE = new Int32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1
  CRC_TABLE[n] = c
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(8 + data.length + 4)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  data.copy(out, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}

export function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
  const stride = 1 + width * 4
  const raw = Buffer.alloc(height * stride)
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0 // filter: none
    Buffer.from(rgba.buffer, y * width * 4, width * 4).copy(raw, y * stride + 1)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** 生成含一个或多个二维码的 PNG:白底、横向排列、每模块 modulePx 像素、4 模块留白 */
export function qrPng(texts: string[], modulePx = 8): Buffer {
  const quiet = 4
  const matrices = texts.map(text => {
    const qr = QRCode.create(text, { errorCorrectionLevel: 'M' })
    return { size: qr.modules.size, data: qr.modules.data as Uint8Array }
  })
  const images = matrices.map(m => (m.size + quiet * 2) * modulePx)
  const height = Math.max(...images)
  const gap = 8 * modulePx
  const width = images.reduce((sum, w) => sum + w, 0) + gap * (texts.length + 1)
  const rgba = new Uint8Array(width * height * 4).fill(255)
  let cursor = gap
  for (const m of matrices) {
    const imgWidth = (m.size + quiet * 2) * modulePx
    const top = Math.floor((height - imgWidth) / 2)
    for (let my = 0; my < m.size; my++) {
      for (let mx = 0; mx < m.size; mx++) {
        if (!m.data[my * m.size + mx]) continue
        for (let py = 0; py < modulePx; py++) {
          for (let px = 0; px < modulePx; px++) {
            const y = top + (my + quiet) * modulePx + py
            const x = cursor + (mx + quiet) * modulePx + px
            const i = (y * width + x) * 4
            rgba[i] = rgba[i + 1] = rgba[i + 2] = 0
          }
        }
      }
    }
    cursor += imgWidth + gap
  }
  return encodePng(width, height, rgba)
}

/** 纯色图:用于"无二维码"用例 */
export function solidPng(width = 300, height = 300): Buffer {
  return encodePng(width, height, new Uint8Array(width * height * 4).fill(255))
}
