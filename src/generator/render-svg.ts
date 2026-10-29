import type { QrMatrix } from './matrix'
import type { QrStyle } from './style'

/** 定位角(眼睛)占据 7×7 模块,由渲染器独立绘制,不参与模块形状 */
export function isFinderModule(x: number, y: number, size: number): boolean {
  return (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7)
}

function roundRectPath(x: number, y: number, w: number, h: number, r: number): string {
  return (
    `M${x + r} ${y}h${w - 2 * r}` +
    `a${r} ${r} 0 0 1 ${r} ${r}` +
    `v${h - 2 * r}` +
    `a${r} ${r} 0 0 1 -${r} ${r}` +
    `h${-(w - 2 * r)}` +
    `a${r} ${r} 0 0 1 -${r} -${r}` +
    `v${-(h - 2 * r)}` +
    `a${r} ${r} 0 0 1 ${r} -${r}z`
  )
}

function circlePath(cx: number, cy: number, r: number): string {
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 -${2 * r} 0z`
}

/** 矩阵 + 样式 → SVG 字符串(纯函数;坐标单位 = 模块) */
export function renderQrSvg(matrix: QrMatrix, style: QrStyle): string {
  const total = matrix.size + style.margin * 2
  const defs: string[] = []

  // 前景:纯色或整体渐变(userSpaceOnUse,避免逐模块渐变)
  let fill: string
  if (style.gradient === 'none') {
    fill = style.foreground
  } else {
    fill = 'url(#qr-foreground)'
    const stops = `<stop offset="0" stop-color="${style.foreground}"/><stop offset="1" stop-color="${style.foreground2}"/>`
    defs.push(
      style.gradient === 'linear'
        ? `<linearGradient id="qr-foreground" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${total}" y2="0" gradientTransform="rotate(${style.gradientRotation} ${total / 2} ${total / 2})">${stops}</linearGradient>`
        : `<radialGradient id="qr-foreground" gradientUnits="userSpaceOnUse" cx="${total / 2}" cy="${total / 2}" r="${total / 2}">${stops}</radialGradient>`,
    )
  }

  const background =
    style.background === 'transparent'
      ? ''
      : `<rect width="${total}" height="${total}" fill="${style.background}"/>`

  // Logo 挖孔范围(模块单位,圆形判定)
  const holeRadius = style.logo
    ? (total * style.logo.sizeRatio) / 2 + (style.logo.padding ? 0.75 : 0)
    : 0
  const holeCx = total / 2
  const holeCy = total / 2

  // 模块层(排除定位角与 Logo 覆盖区)
  let squarePath = ''
  const circles: string[] = []
  const rects: string[] = []
  for (let my = 0; my < matrix.size; my++) {
    for (let mx = 0; mx < matrix.size; mx++) {
      if (matrix.data[my * matrix.size + mx] === 0) continue
      if (isFinderModule(mx, my, matrix.size)) continue
      const cx = mx + style.margin + 0.5
      const cy = my + style.margin + 0.5
      if (holeRadius > 0 && (cx - holeCx) ** 2 + (cy - holeCy) ** 2 < holeRadius * holeRadius) continue
      const x = mx + style.margin
      const y = my + style.margin
      if (style.moduleShape === 'square') {
        squarePath += `M${x} ${y}h1v1h-1z`
      } else if (style.moduleShape === 'rounded') {
        rects.push(`<rect x="${x}" y="${y}" width="1" height="1" rx="0.3"/>`)
      } else {
        circles.push(`<circle cx="${cx}" cy="${cy}" r="0.44"/>`)
      }
    }
  }
  let moduleLayer: string
  if (style.moduleShape === 'square') {
    moduleLayer = squarePath ? `<path d="${squarePath}" fill="${fill}"/>` : ''
  } else if (style.moduleShape === 'rounded') {
    moduleLayer = `<g fill="${fill}">${rects.join('')}</g>`
  } else {
    moduleLayer = `<g fill="${fill}">${circles.join('')}</g>`
  }

  // 定位角:恒为实心环(可扫性规则),形状与颜色独立
  const eyeOrigins: Array<[number, number, string]> = [
    [0, 0, 'tl'],
    [matrix.size - 7, 0, 'tr'],
    [0, matrix.size - 7, 'bl'],
  ]
  const eyeLayers = eyeOrigins.map(([ox, oy, label]) => {
    const x = ox + style.margin
    const y = oy + style.margin
    let frame: string
    if (style.eyeFrameShape === 'square') {
      frame = `<path d="M${x} ${y}h7v7h-7z M${x + 1} ${y + 1}v5h5v-5z" fill-rule="evenodd" fill="${style.eyeFrameColor}"/>`
    } else if (style.eyeFrameShape === 'rounded') {
      frame = `<path d="${roundRectPath(x, y, 7, 7, 2.1)}${roundRectPath(x + 1, y + 1, 5, 5, 1.4)}" fill-rule="evenodd" fill="${style.eyeFrameColor}"/>`
    } else {
      frame = `<path d="${circlePath(x + 3.5, y + 3.5, 3.5)}${circlePath(x + 3.5, y + 3.5, 2.5)}" fill-rule="evenodd" fill="${style.eyeFrameColor}"/>`
    }
    let ball: string
    if (style.eyeBallShape === 'square') {
      ball = `<path d="M${x + 2} ${y + 2}h3v3h-3z" fill="${style.eyeBallColor}"/>`
    } else if (style.eyeBallShape === 'rounded') {
      ball = `<path d="${roundRectPath(x + 2, y + 2, 3, 3, 1)}" fill="${style.eyeBallColor}"/>`
    } else {
      ball = `<path d="${circlePath(x + 3.5, y + 3.5, 1.5)}" fill="${style.eyeBallColor}"/>`
    }
    return `<g data-eye="${label}">${frame}${ball}</g>`
  })

  // Logo
  let logoLayer = ''
  if (style.logo) {
    const size = total * style.logo.sizeRatio
    const lx = (total - size) / 2
    if (style.logo.shape === 'circle') {
      defs.push(`<clipPath id="qr-logo-clip"><circle cx="${lx + size / 2}" cy="${lx + size / 2}" r="${size / 2}"/></clipPath>`)
      logoLayer = `<image href="${style.logo.dataUrl}" x="${lx}" y="${lx}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet" clip-path="url(#qr-logo-clip)"/>`
    } else {
      logoLayer = `<image href="${style.logo.dataUrl}" x="${lx}" y="${lx}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet"/>`
    }
  }

  const defsLayer = defs.length > 0 ? `<defs>${defs.join('')}</defs>` : ''
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${total * 8}" height="${total * 8}">` +
    defsLayer +
    background +
    moduleLayer +
    eyeLayers.join('') +
    logoLayer +
    `</svg>`
  )
}
