import { svgToCanvas } from './render-canvas'

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadSvg(svg: string, filename: string): void {
  downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), filename)
}

export async function downloadPng(svg: string, size: number, filename: string): Promise<void> {
  const canvas = await svgToCanvas(svg, size)
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
  if (blob) downloadBlob(blob, filename)
}

export async function copyPng(svg: string, size: number): Promise<boolean> {
  try {
    const canvas = await svgToCanvas(svg, size)
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
    if (!blob || !('ClipboardItem' in window)) return false
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    return true
  } catch {
    return false
  }
}
