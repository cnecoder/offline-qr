// 生成应用图标源图(1024×1024 PNG),随后由 `npx tauri icon` 派生各平台尺寸。
// 无第三方依赖:使用 Node 内置 zlib 手写 PNG 编码。
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const S = 1024
const R = 220 // 圆角半径
const BG = [79, 70, 229] // 靛蓝 #4F46E5
const FG = [255, 255, 255]

const px = new Uint8Array(S * S * 4)

function set(x, y, [r, g, b]) {
  const i = (y * S + x) * 4
  px[i] = r
  px[i + 1] = g
  px[i + 2] = b
  px[i + 3] = 255
}

function fillRect(x0, y0, w, h, color) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (x >= 0 && y >= 0 && x < S && y < S) set(x, y, color)
    }
  }
}

// 圆角方形底:四个角做圆角判定
const corners = [
  { cx: R, cy: R, test: (x, y) => x < R && y < R },
  { cx: S - 1 - R, cy: R, test: (x, y) => x > S - 1 - R && y < R },
  { cx: R, cy: S - 1 - R, test: (x, y) => x < R && y > S - 1 - R },
  { cx: S - 1 - R, cy: S - 1 - R, test: (x, y) => x > S - 1 - R && y > S - 1 - R },
]
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    let outside = false
    for (const c of corners) {
      if (c.test(x, y)) {
        const dx = x - c.cx
        const dy = y - c.cy
        if (dx * dx + dy * dy > R * R) {
          outside = true
          break
        }
      }
    }
    if (!outside) set(x, y, BG)
  }
}

// 三个二维码定位角(白环 + 底色孔)
const EYE = 236
const HOLE = 96
const PAD = (EYE - HOLE) / 2
const eyes = [
  [140, 140],
  [S - 140 - EYE, 140],
  [140, S - 140 - EYE],
]
for (const [ex, ey] of eyes) {
  fillRect(ex, ey, EYE, EYE, FG)
  fillRect(ex + PAD, ey + PAD, HOLE, HOLE, BG)
}

// 右下 2×2 装饰点阵
for (const dx of [648, 788]) {
  for (const dy of [648, 788]) {
    fillRect(dx, dy, 96, 96, FG)
  }
}

// ---- PNG 编码 ----
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
