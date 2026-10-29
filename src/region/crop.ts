import type { Rect } from './selection'

export interface ImageRect {
  x: number
  y: number
  width: number
  height: number
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(Math.max(value, lo), hi)
}

/**
 * CSS 选区 → 原图像素区域。
 * scale = 图像宽 / 视口宽(即设备像素比方向);四舍五入后夹紧到图像边界。
 */
export function toImageRect(
  rect: Rect,
  scale: number,
  imageWidth: number,
  imageHeight: number,
): ImageRect {
  const x0 = clamp(Math.round(rect.x * scale), 0, imageWidth)
  const y0 = clamp(Math.round(rect.y * scale), 0, imageHeight)
  const x1 = clamp(Math.round((rect.x + rect.width) * scale), 0, imageWidth)
  const y1 = clamp(Math.round((rect.y + rect.height) * scale), 0, imageHeight)
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
}
