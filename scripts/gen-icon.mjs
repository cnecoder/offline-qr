// 生成应用图标源图(1024×1024 PNG,候选 A「定位角」黑白灰银方案),
// 随后由 `npx tauri icon` 派生各平台尺寸。无第三方依赖:Node 内置 zlib 手写 PNG 编码。
// 设计:深灰渐变圆角底 + 三个银渐变描边定位角(白芯)+ 右下数据点阵。
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const S = 1024
const R = 232 // 画布圆角半径(约 22.7%)

const px = new Uint8Array(S * S * 4) // 初始全 0 = 四角透明

function set(x, y, [r, g, b], a = 255) {
  const i = (y * S + x) * 4
  px[i] = r
  px[i + 1] = g
  px[i + 2] = b
  px[i + 3] = a
}

function mix(c1, c2, t) {
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * t),
    Math.round(c1[1] + (c2[1] - c1[1]) * t),
    Math.round(c1[2] + (c2[2] - c1[2]) * t),
  ]
}

const CANVAS_TOP = [30, 34, 43] // #1E222B
const CANVAS_BOT = [11, 12, 15] // #0B0C0F
const SILVER_STOPS = [
  [0, [247, 249, 252]], // #F7F9FC
  [0.45, [201, 207, 218]], // #C9CFDA
  [0.7, [237, 239, 244]], // #EDEFF4
  [1, [167, 175, 189]], // #A7AFBD
]
const WHITE = [255, 255, 255]

function canvasColor(x, y) {
  const t = Math.min(1, Math.max(0, y / S))
  return mix(CANVAS_TOP, CANVAS_BOT, t)
}

function silverColor(x, y) {
  const t = Math.min(1, Math.max(0, (x + y) / (2 * S)))
  for (let i = 1; i < SILVER_STOPS.length; i++) {
    const [t0, c0] = SILVER_STOPS[i - 1]
    const [t1, c1] = SILVER_STOPS[i]
    if (t <= t1) return mix(c0, c1, (t - t0) / (t1 - t0))
  }
  return SILVER_STOPS[SILVER_STOPS.length - 1][1]
}

function insideRoundRect(x, y, x0, y0, w, h, rx) {
  const dx = Math.max(Math.abs(x - (x0 + w / 2)) - (w / 2 - rx), 0)
  const dy = Math.max(Math.abs(y - (y0 + h / 2)) - (h / 2 - rx), 0)
  return dx * dx + dy * dy <= rx * rx
}

// ---- 画布:深灰渐变圆角方形(四角透明) ----
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    if (insideRoundRect(x, y, 0, 0, S, S, R)) set(x, y, canvasColor(x, y))
  }
}

// ---- 三个定位角:银渐变描边(圆角环)+ 白芯 ----
// 环 = 外圆角矩形减内圆角矩形;孔内透出画布渐变(逐像素取色,无缝)
const EYES = [
  [176, 176],
  [592, 176],
  [176, 592],
]
const EYE = 256 // 32 × 8
const HOLE = 80 // 10 × 8(孔径 = 环内空隙)
const HOLE_PAD = (EYE - HOLE) / 2
for (const [ex, ey] of EYES) {
  for (let y = ey; y < ey + EYE; y++) {
    for (let x = ex; x < ex + EYE; x++) {
      if (insideRoundRect(x, y, ex, ey, EYE, EYE, 72) && !insideRoundRect(x, y, ex + HOLE_PAD, ey + HOLE_PAD, HOLE, HOLE, 28)) {
        set(x, y, silverColor(x, y))
      }
    }
  }
  // 白芯
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (insideRoundRect(x, y, ex + 80, ey + 80, 96, 96, 28)) set(x, y, WHITE)
    }
  }
}

// ---- 右下数据点阵(2×2,透明度递减) ----
const DOTS = [
  [640, 640, [139, 147, 163]], // #8B93A3
  [768, 640, [74, 80, 96]], // #4A5060
  [640, 768, [74, 80, 96]], // #4A5060
  [768, 768, [51, 57, 71]], // #333947
]
for (const [dx, dy, color] of DOTS) {
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (insideRoundRect(x, y, dx, dy, 80, 80, 24)) set(x, y, color)
    }
  }
}

// ---- PNG 编码(RGBA) ----
const CRC_TABLE = new Int32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1
  CRC_TABLE[n] = c
}

function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  data.copy(out, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(S, 0)
ihdr.writeUInt32BE(S, 4)
ihdr[8] = 8 // bit depth
ihdr[9] = 6 // color type: RGBA

const stride = 1 + S * 4
const raw = Buffer.alloc(S * stride)
for (let y = 0; y < S; y++) {
  raw[y * stride] = 0 // filter: none
  Buffer.from(px.buffer, y * S * 4, S * 4).copy(raw, y * stride + 1)
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
])

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src-tauri', 'icons')
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'icon.png'), png)
console.log(`icon written: ${join(outDir, 'icon.png')} (${png.length} bytes)`)
