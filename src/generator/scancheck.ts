import { decodePixels } from '../scanner/decode'
import { svgToCanvas } from './render-canvas'

export type ScanVerdict = 'ok' | 'fail'

const CHECK_SIZE = 320

/** 可扫性自检:栅格化(垫白底,透明像素对解码器等于纯黑)后用识别引擎试扫 */
export async function checkScanability(svg: string): Promise<ScanVerdict> {
  const canvas = await svgToCanvas(svg, CHECK_SIZE, { background: '#ffffff' })
  const ctx = canvas.getContext('2d')
  if (!ctx) return 'fail'
  const pixels = ctx.getImageData(0, 0, CHECK_SIZE, CHECK_SIZE)
  const texts = await decodePixels(pixels)
  return texts.length > 0 ? 'ok' : 'fail'
}
