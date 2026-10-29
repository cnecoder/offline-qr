import { describe, expect, it } from 'vitest'
import { createMatrix } from './matrix'
import { isFinderModule, renderQrSvg } from './render-svg'
import { DEFAULT_STYLE, PRESETS } from './style'

const matrix = createMatrix('https://example.com/svg', 'M')

function base() {
  return { ...DEFAULT_STYLE }
}

function count(svg: string, re: RegExp): number {
  return (svg.match(re) ?? []).length
}

describe('createMatrix', () => {
  it('生成合法矩阵(最小 21×21)', () => {
    expect(matrix.size).toBeGreaterThanOrEqual(21)
    expect(matrix.data).toHaveLength(matrix.size * matrix.size)
    expect(matrix.get(0, 0)).toBe(true) // 定位角必为深色
  })

  it('内容超容量时抛错', () => {
    expect(() => createMatrix('x'.repeat(4000), 'L')).toThrow()
  })
})

describe('isFinderModule', () => {
  it('定位角仅有左上/右上/左下三个(QR 无右下定位角)', () => {
    const size = 25
    expect(isFinderModule(0, 0, size)).toBe(true)
    expect(isFinderModule(24, 0, size)).toBe(true)
    expect(isFinderModule(0, 24, size)).toBe(true)
    expect(isFinderModule(7, 0, size)).toBe(false)
    expect(isFinderModule(12, 12, size)).toBe(false)
    expect(isFinderModule(18, 18, size)).toBe(false) // 右下是对齐图案,不是定位角
    expect(isFinderModule(2, 24, size)).toBe(true)
    expect(isFinderModule(24, 2, size)).toBe(true)
  })
})

describe('renderQrSvg', () => {
  it('根元素与 viewBox(含留白)', () => {
    const svg = renderQrSvg(matrix, base())
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
    expect(svg).toContain(`viewBox="0 0 ${matrix.size + 8} ${matrix.size + 8}"`)
    expect(svg.endsWith('</svg>')).toBe(true)
  })

  it('方块模块:每个非定位角深色模块一个路径段', () => {
    const svg = renderQrSvg(matrix, base())
    let expected = 0
    for (let y = 0; y < matrix.size; y++) {
      for (let x = 0; x < matrix.size; x++) {
        if (matrix.get(x, y) && !isFinderModule(x, y, matrix.size)) expected++
      }
    }
    expect(count(svg, /h1v1h-1z/g)).toBe(expected)
    expect(expected).toBeGreaterThan(0)
  })

  it('三只眼睛独立绘制(tl/tr/bl)', () => {
    const svg = renderQrSvg(matrix, base())
    expect(count(svg, /data-eye="/g)).toBe(3)
    expect(svg).toContain('data-eye="tl"')
    expect(svg).toContain('data-eye="tr"')
    expect(svg).toContain('data-eye="bl"')
  })

  it('圆点/圆角形状输出对应元素', () => {
    expect(renderQrSvg(matrix, { ...base(), moduleShape: 'dot' })).toContain('<circle')
    expect(renderQrSvg(matrix, { ...base(), moduleShape: 'rounded' })).toContain('rx="0.3"')
  })

  it('线性/径向渐变:userSpaceOnUse 且双色 stop', () => {
    const linear = renderQrSvg(matrix, { ...base(), gradient: 'linear', foreground: '#111111', foreground2: '#eeeeee' })
    expect(linear).toContain('<linearGradient')
    expect(linear).toContain('gradientUnits="userSpaceOnUse"')
    expect(linear).toContain('#111111')
    expect(linear).toContain('#eeeeee')
    const radial = renderQrSvg(matrix, { ...base(), gradient: 'radial', foreground: '#111111', foreground2: '#eeeeee' })
    expect(radial).toContain('<radialGradient')
  })

  it('眼睛颜色独立于前景', () => {
    const svg = renderQrSvg(matrix, { ...base(), foreground: '#000000', eyeFrameColor: '#ff0000', eyeBallColor: '#00ff00' })
    expect(svg).toContain('#ff0000')
    expect(svg).toContain('#00ff00')
  })

  it('透明背景无背景矩形,实心背景有', () => {
    expect(renderQrSvg(matrix, { ...base(), background: 'transparent' })).not.toContain('<rect width=')
    expect(renderQrSvg(matrix, base())).toContain('<rect width=')
  })

  it('Logo:输出 image 并挖空覆盖模块', () => {
    const plain = renderQrSvg(matrix, base())
    const logoStyle = {
      ...base(),
      logo: { dataUrl: 'data:image/png;base64,AAAA', sizeRatio: 0.22, shape: 'circle' as const, padding: true },
    }
    const withLogo = renderQrSvg(matrix, logoStyle)
    expect(withLogo).toContain('<image href="data:image/png;base64,AAAA"')
    expect(withLogo).toContain('<clipPath')
    expect(count(withLogo, /h1v1h-1z/g)).toBeLessThan(count(plain, /h1v1h-1z/g))
  })

  it('留白 0 时 viewBox 等于矩阵尺寸', () => {
    const svg = renderQrSvg(matrix, { ...base(), margin: 0 })
    expect(svg).toContain(`viewBox="0 0 ${matrix.size} ${matrix.size}"`)
  })

  it('预设均可渲染且互不相同', () => {
    const svgs = PRESETS.map(preset => renderQrSvg(matrix, { ...DEFAULT_STYLE, ...preset.style }))
    for (const svg of svgs) expect(svg).toContain('<svg')
    expect(new Set(svgs).size).toBe(svgs.length)
  })
})
