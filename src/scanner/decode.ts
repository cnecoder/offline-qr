import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'
import { prepareZXingModule, readBarcodes, type ReaderOptions } from 'zxing-wasm/reader'

/**
 * 最小像素数据:与 DOM ImageData 同形。
 * 独立成接口是为了让解码逻辑可在无 canvas 的环境(单测)中驱动。
 */
export interface PixelData {
  data: Uint8ClampedArray<ArrayBuffer>
  width: number
  height: number
}

// Worker 以 blob URL 运行,无法按模块相对路径解析 wasm,这里固定覆写定位逻辑
prepareZXingModule({ overrides: { locateFile: () => wasmUrl } })

// 固定解码参数:识别率优先(允许更慢),只识别 QR Code
const READER_OPTIONS: ReaderOptions = {
  formats: ['QRCode'],
  tryHarder: true,
  tryRotate: true,
  tryInvert: true,
  tryDownscale: true,
}

/** 解码一张图的像素,返回其中全部 QR 码文本(一图多码) */
export async function decodePixels(pixels: PixelData): Promise<string[]> {
  const results = await readBarcodes(toImageData(pixels), READER_OPTIONS)
  return results.map(result => result.text)
}

function toImageData(pixels: PixelData): ImageData {
  // 优先构造真实 ImageData(引擎按 ImageData 处理);无该全局的环境退回同形对象
  if (typeof ImageData === 'function') {
    return new ImageData(pixels.data, pixels.width, pixels.height)
  }
  return pixels as unknown as ImageData
}
