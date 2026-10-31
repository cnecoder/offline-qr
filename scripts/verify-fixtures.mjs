// 人工测试样张的自动 QA 门禁:每张样张用识别引擎回读,断言内容与预期一致。
// 用法:npm run verify:fixtures(在生成样张后运行)
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader'

const wasm = readFileSync(resolve('node_modules/zxing-wasm/dist/reader/zxing_reader.wasm'))
await prepareZXingModule({
  overrides: { wasmBinary: wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength) },
  fireImmediately: true,
})

const opts = { formats: ['QRCode'], tryHarder: true, tryRotate: true, tryInvert: true, tryDownscale: true }
const dir = 'test_picture/fixtures'

const cases = {
  '01-text-url.png': t => t.includes('https://example.com/qr-manual-test'),
  '02-text-chinese.png': t => t.includes('你好,二维码工具!\n第二行:离线识别测试'),
  '03-text-long.png': t => t.some(s => s.startsWith('第 1 行') && s.includes('第 12 行')),
  '04-wifi-wpa.png': t => t.includes('WIFI:T:WPA;S:HomeNet;P:pass123;;'),
  '05-wifi-escaped.png': t => t.includes('WIFI:T:WPA;S:net\\;\\,\\"x;P:p\\:a\\,s\\\\s;;'),
  '06-wifi-nopass.png': t => t.includes('WIFI:T:nopass;S:OpenNet;;'),
  '07-vcard.png': t => t.some(s => s.startsWith('BEGIN:VCARD') && s.includes('FN:张三')),
  '08-multi-3codes.png': t => t.length === 3 && t.includes('https://two.example.com'),
  '09-low-quality.png': t => t.includes('https://example.com/low-quality'),
  '10-inverted.png': t => t.includes('https://example.com/inverted'),
  '11-colored-dot.png': t => t.includes('https://example.com/colored-dot'),
  '12-tiny.png': t => t.includes('https://example.com/tiny'),
  'logo-sample.png': t => t.length === 0,
}

let fail = 0
for (const [file, check] of Object.entries(cases)) {
  const buf = readFileSync(resolve(dir, file))
  const texts = (await readBarcodes(new Uint8Array(buf), opts)).map(r => r.text)
  const ok = check(texts)
  if (!ok) fail++
  console.log(ok ? 'OK  ' : 'FAIL', file, '→', JSON.stringify(texts).slice(0, 90))
}
console.log(fail === 0 ? '=== 全部通过 ===' : `=== 失败 ${fail} 张 ===`)
process.exitCode = fail === 0 ? 0 : 1
