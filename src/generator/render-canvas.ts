/** SVG 字符串 → 指定尺寸的 canvas 栅格化(可选垫底色,如可扫性检测垫白) */
export async function svgToCanvas(
  svg: string,
  size: number,
  options?: { background?: string },
): Promise<HTMLCanvasElement> {
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  const image = new Image()
  image.src = url
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布上下文')
  if (options?.background) {
    ctx.fillStyle = options.background
    ctx.fillRect(0, 0, size, size)
  }
  ctx.drawImage(image, 0, 0, size, size)
  return canvas
}
