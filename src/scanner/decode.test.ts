import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import QRCode from 'qrcode'
import { prepareZXingModule } from 'zxing-wasm/reader'
import { decodePixels, type PixelData } from './decode'

// 单测环境无法 fetch wasm 资源,直接以字节码注入(emscripten wasmBinary)
beforeAll(async () => {
  const wasmFile = readFileSync(
    resolve(process.cwd(), 'node_modules/zxing-wasm/dist/reader/zxing_reader.wasm'),
  )
  const wasmBinary = wasmFile.buffer.slice(
    wasmFile.byteOffset,
    wasmFile.byteOffset + wasmFile.byteLength,
  ) as ArrayBuffer
  await prepareZXingModule({ overrides: { wasmBinary }, fireImmediately: true })
})

/** 用 qrcode 库生成 QR 矩阵(0/1) */
function qrMatrix(text: string): { size: number; data: Uint8Array } {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' })
  return { size: qr.modules.size, data: qr.modules.data as Uint8Array }
}

/** 矩阵 → RGBA 像素;每模块渲染 modulePx 像素,四周加 4 模块留白(quiet zone) */
function matrixToPixels(size: number, data: Uint8Array, modulePx = 8, quiet = 4): PixelData {
  const total = (size + quiet * 2) * modulePx
  const out = new Uint8ClampedArray(total * total * 4).fill(255)
  for (let my = 0; my < size; my++) {
    for (let mx = 0; mx < size; mx++) {
      if (!data[my * size + mx]) continue
      const y0 = (my + quiet) * modulePx
      const x0 = (mx + quiet) * modulePx
      for (let y = y0; y < y0 + modulePx; y++) {
        for (let x = x0; x < x0 + modulePx; x++) {
          const i = (y * total + x) * 4
          out[i] = out[i + 1] = out[i + 2] = 0
        }
      }
    }
  }
  return { data: out, width: total, height: total }
}

/** 缩小到 1/3(块均值):模拟低分辨率截图的真实形态(边缘带抗锯齿) */
function downscale(pixels: PixelData): PixelData {
  const f = 3
  const sw = Math.floor(pixels.width / f)
  const sh = Math.floor(pixels.height / f)
  const small = new Uint8ClampedArray(sw * sh * 4)
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      for (let c = 0; c < 4; c++) {
        let sum = 0
        for (let dy = 0; dy < f; dy++) {
          for (let dx = 0; dx < f; dx++) {
            sum += pixels.data[((y * f + dy) * pixels.width + x * f + dx) * 4 + c]
          }
        }
        small[(y * sw + x) * 4 + c] = sum / (f * f)
      }
    }
  }
  return { data: small, width: sw, height: sh }
}

/** 灰阶低量化 + 确定性抖动:模拟压缩/低质量图像 */
function quantizeWithDither(pixels: PixelData): PixelData {
  const out = new Uint8ClampedArray(pixels.data)
  for (let y = 0; y < pixels.height; y++) {
    for (let x = 0; x < pixels.width; x++) {
      const i = (y * pixels.width + x) * 4
      const noise = ((x * 7 + y * 13) % 40) - 20
      const gray = 0.299 * out[i] + 0.587 * out[i + 1] + 0.114 * out[i + 2] + noise
      const level = gray < 64 ? 0 : gray > 192 ? 255 : 128
      out[i] = out[i + 1] = out[i + 2] = level
    }
  }
  return { data: out, width: pixels.width, height: pixels.height }
}

function invert(pixels: PixelData): PixelData {
  const out = new Uint8ClampedArray(pixels.data)
  for (let i = 0; i < out.length; i += 4) {
    out[i] = 255 - out[i]
    out[i + 1] = 255 - out[i + 1]
    out[i + 2] = 255 - out[i + 2]
  }
  return { data: out, width: pixels.width, height: pixels.height }
}

/** 将多张像素图横向拼接(白底 + 8px 间隔),用于一图多码用例 */
function composeHorizontal(images: PixelData[]): PixelData {
  const gap = 8
  const height = Math.max(...images.map(img => img.height))
  const width = images.reduce((sum, img) => sum + img.width, 0) + gap * (images.length + 1)
  const out = new Uint8ClampedArray(width * height * 4).fill(255)
  let cursor = gap
  for (const img of images) {
    const top = Math.floor((height - img.height) / 2)
    for (let y = 0; y < img.height; y++) {
      const dstRow = ((top + y) * width + cursor) * 4
      const srcRow = y * img.width * 4
      out.set(img.data.subarray(srcRow, srcRow + img.width * 4), dstRow)
    }
    cursor += img.width + gap
  }
  return { data: out, width, height }
}

const TIMEOUT = 30_000

describe('decodePixels(zxing-wasm 真实解码)', () => {
  it(
    '常规文本',
    async () => {
      const text = 'https://example.com/offlineqr'
      const matrix = qrMatrix(text)
      const pixels = matrixToPixels(matrix.size, matrix.data)
      await expect(decodePixels(pixels)).resolves.toEqual([text])
    },
    TIMEOUT,
  )

  it(
    '中文与多行内容(UTF-8)',
    async () => {
      const text = '你好,二维码\n第二行内容'
      const matrix = qrMatrix(text)
      const pixels = matrixToPixels(matrix.size, matrix.data)
      await expect(decodePixels(pixels)).resolves.toEqual([text])
    },
    TIMEOUT,
  )

  it(
    '低分辨率(1/3 缩小)图仍可识别',
    async () => {
      const text = 'https://example.com/blurry'
      const matrix = qrMatrix(text)
      await expect(
        decodePixels(downscale(matrixToPixels(matrix.size, matrix.data))),
      ).resolves.toEqual([text])
    },
    TIMEOUT,
  )

  it(
    '低量化 + 抖动图仍可识别',
    async () => {
      const text = 'https://example.com/quantized'
      const matrix = qrMatrix(text)
      await expect(
        decodePixels(quantizeWithDither(matrixToPixels(matrix.size, matrix.data))),
      ).resolves.toEqual([text])
    },
    TIMEOUT,
  )

  it(
    '反色图仍可识别(tryInvert)',
    async () => {
      const text = 'https://example.com/inverted'
      const matrix = qrMatrix(text)
      await expect(decodePixels(invert(matrixToPixels(matrix.size, matrix.data)))).resolves.toEqual([text])
    },
    TIMEOUT,
  )

  it(
    '一图多码:全部识别',
    async () => {
      const texts = ['https://one.example.com', 'https://two.example.com']
      const images = texts.map(t => {
        const m = qrMatrix(t)
        return matrixToPixels(m.size, m.data)
      })
      const composed = composeHorizontal(images)
      const decoded = await decodePixels(composed)
      expect([...decoded].sort()).toEqual([...texts].sort())
    },
    TIMEOUT,
  )

  it(
    '无二维码的纯色图返回空数组',
    async () => {
      const pixels: PixelData = {
        data: new Uint8ClampedArray(200 * 200 * 4).fill(255),
        width: 200,
        height: 200,
      }
      await expect(decodePixels(pixels)).resolves.toEqual([])
    },
    TIMEOUT,
  )
})
