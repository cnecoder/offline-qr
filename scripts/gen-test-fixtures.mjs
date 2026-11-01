// 生成人工手动测试用的二维码样张 → test_picture/fixtures/
// 复用应用源码(content 模板编码)与 E2E 样张的 PNG 编码器;
// 依赖 Node 24+ 的 TypeScript 类型剥离直接执行 .ts 模块(npm run fixtures)。
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import QRCode from 'qrcode'
import { contentToText } from '../src/generator/content.ts'
import { encodePng } from '../tests/e2e/helpers.ts'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'test_picture', 'fixtures')
mkdirSync(OUT, { recursive: true })

function matrixOf(text, ecc = 'M') {
  const qr = QRCode.create(text, { errorCorrectionLevel: ecc })
  return { size: qr.modules.size, data: qr.modules.data }
}

function setPx(rgba, w, x, y, [r, g, b]) {
  const i = (y * w + x) * 4
  rgba[i] = r
  rgba[i + 1] = g
  rgba[i + 2] = b
  rgba[i + 3] = 255
}

function qrRgba(text, { ecc = 'M', modulePx = 8, quiet = 4, fg = [0, 0, 0], bg = [255, 255, 255], dot = false } = {}) {
  const m = matrixOf(text, ecc)
  const total = (m.size + quiet * 2) * modulePx
  const rgba = new Uint8Array(total * total * 4)
  for (let i = 0; i < total * total; i++) {
    rgba[i * 4] = bg[0]
    rgba[i * 4 + 1] = bg[1]
    rgba[i * 4 + 2] = bg[2]
    rgba[i * 4 + 3] = 255
  }
  for (let my = 0; my < m.size; my++) {
    for (let mx = 0; mx < m.size; mx++) {
      if (!m.data[my * m.size + mx]) continue
      const isEye = (mx < 7 && my < 7) || (mx >= m.size - 7 && my < 7) || (mx < 7 && my >= m.size - 7)
      const color = fg
      if (dot && !isEye) {
        // 圆点风格:定位角保持实心方块(与渲染器规则一致)
        const cx = (mx + quiet + 0.5) * modulePx
        const cy = (my + quiet + 0.5) * modulePx
        const r = 0.44 * modulePx
        for (let py = Math.floor(cy - r); py <= Math.ceil(cy + r); py++)
          for (let px = Math.floor(cx - r); px <= Math.ceil(cx + r); px++)
            if ((px + 0.5 - cx) ** 2 + (py + 0.5 - cy) ** 2 <= r * r) setPx(rgba, total, px, py, color)
      } else {
        const x0 = (mx + quiet) * modulePx
        const y0 = (my + quiet) * modulePx
        for (let py = y0; py < y0 + modulePx; py++)
          for (let px = x0; px < x0 + modulePx; px++) setPx(rgba, total, px, py, color)
      }
    }
  }
  return { rgba, width: total, height: total }
}

function downscale({ rgba, width, height }, f = 4) {
  const w = Math.floor(width / f)
  const h = Math.floor(height / f)
  const out = new Uint8Array(w * h * 4)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      for (let c = 0; c < 4; c++) {
        let sum = 0
        for (let dy = 0; dy < f; dy++)
          for (let dx = 0; dx < f; dx++) sum += rgba[((y * f + dy) * width + x * f + dx) * 4 + c]
        out[(y * w + x) * 4 + c] = sum / (f * f)
      }
  return { rgba: out, width: w, height: h }
}

function composeH(images, gap = 32) {
  const height = Math.max(...images.map(i => i.height))
  const width = images.reduce((s, i) => s + i.width, 0) + gap * (images.length + 1)
  const rgba = new Uint8Array(width * height * 4).fill(255)
  let cursor = gap
  for (const img of images) {
    const top = Math.floor((height - img.height) / 2)
    for (let y = 0; y < img.height; y++) {
      const dst = ((top + y) * width + cursor) * 4
      rgba.set(img.rgba.subarray(y * img.width * 4, (y + 1) * img.width * 4), dst)
    }
    cursor += img.width + gap
  }
  return { rgba, width, height }
}

function save(name, image) {
  writeFileSync(join(OUT, name), encodePng(image.width, image.height, image.rgba))
  console.log('generated:', name)
}

// ---- 内容(复用应用的模板编码,保证与"生成 Tab"产出一致)----
const wifi = (ssid, password, encryption = 'WPA', hidden = false) => ({ kind: 'wifi', ssid, password, encryption, hidden })
const vcard = {
  kind: 'vcard',
  name: '张三',
  mobile: '13800138000',
  phone: '010-12345678',
  email: 'zhangsan@example.com',
  org: '示例科技',
  title: '工程师',
  url: 'https://example.com',
  address: '北京市海淀区中关村大街 1 号',
}
const longText = Array.from({ length: 12 }, (_, i) => `第 ${i + 1} 行:二维码工具离线测试内容 abcdefghijklmnopqrstuvwxyz-${i}`).join('\n')

// ---- 样张 ----
save('01-text-url.png', qrRgba('https://example.com/qr-manual-test'))
save('02-text-chinese.png', qrRgba('你好,二维码工具!\n第二行:离线识别测试'))
save('03-text-long.png', qrRgba(longText))
save('04-wifi-wpa.png', qrRgba(contentToText(wifi('HomeNet', 'pass123'))))
save('05-wifi-escaped.png', qrRgba(contentToText(wifi('net;,"x', 'p:a,s\\s'))))
save('06-wifi-nopass.png', qrRgba(contentToText(wifi('OpenNet', '', 'nopass'))))
save('07-vcard.png', qrRgba(contentToText(vcard)))
save(
  '08-multi-3codes.png',
  composeH([
    qrRgba('https://one.example.com'),
    qrRgba('https://two.example.com'),
    qrRgba('https://three.example.com'),
  ]),
)
save('09-low-quality.png', downscale(qrRgba('https://example.com/low-quality'), 4))
save('10-inverted.png', qrRgba('https://example.com/inverted', { fg: [255, 255, 255], bg: [0, 0, 0] }))
save('11-colored-dot.png', qrRgba('https://example.com/colored-dot', { fg: [79, 70, 229], dot: true }))
save('12-tiny.png', qrRgba('https://example.com/tiny', { modulePx: 2 }))

// Logo 测试图(256×256,圆角靛蓝底 + 白色环点,透明角)
function logoSample() {
  const S = 256
  const r = 48
  const indigo = [79, 70, 229]
  const rgba = new Uint8Array(S * S * 4)
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      let inside = true
      for (const [cx, cy] of [
        [r, r],
        [S - 1 - r, r],
        [r, S - 1 - r],
        [S - 1 - r, S - 1 - r],
      ]) {
        const inX = cx === r ? x < r : x > S - 1 - r
        const inY = cy === r ? y < r : y > S - 1 - r
        if (inX && inY && (x - cx) ** 2 + (y - cy) ** 2 > r * r) inside = false
      }
      const i = (y * S + x) * 4
      if (!inside) {
        rgba[i + 3] = 0
        continue
      }
      rgba[i] = indigo[0]
      rgba[i + 1] = indigo[1]
      rgba[i + 2] = indigo[2]
      rgba[i + 3] = 255
    }
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const d2 = (x - 128) ** 2 + (y - 128) ** 2
      if (d2 <= 72 * 72 && d2 >= 48 * 48) setPx(rgba, S, x, y, [255, 255, 255])
      if (d2 <= 28 * 28) setPx(rgba, S, x, y, [255, 255, 255])
    }
  return { rgba, width: S, height: S }
}
save('logo-sample.png', logoSample())

console.log(`done → ${OUT}`)
