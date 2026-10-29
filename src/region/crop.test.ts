import { describe, expect, it } from 'vitest'
import { toImageRect } from './crop'

describe('toImageRect(CSS 选区 → 图像像素)', () => {
  it('整数倍缩放(DPR 2)精确映射', () => {
    expect(toImageRect({ x: 10, y: 20, width: 30, height: 15 }, 2, 1920, 1080)).toEqual({
      x: 20,
      y: 40,
      width: 60,
      height: 30,
    })
  })

  it('分数缩放(DPR 1.25)四舍五入', () => {
    const rect = toImageRect({ x: 33.3, y: 10.6, width: 50.4, height: 20.2 }, 1.25, 2400, 1350)
    // x0 = 33.3*1.25 = 41.625 → 42;y0 = 10.6*1.25 = 13.25 → 13
    // x1 = 83.7*1.25 = 104.625 → 105;y1 = 30.8*1.25 = 38.5 → 39
    expect(rect.x).toBe(42)
    expect(rect.y).toBe(13)
    expect(rect.width).toBe(63) // 105 - 42
    expect(rect.height).toBe(26) // 39 - 13
  })

  it('越界部分夹紧到图像边界', () => {
    const rect = toImageRect({ x: 900, y: 500, width: 200, height: 100 }, 2, 1920, 1080)
    expect(rect.x).toBe(1800)
    expect(rect.y).toBe(1000)
    expect(rect.x + rect.width).toBe(1920)
    expect(rect.y + rect.height).toBe(1080)
  })

  it('负偏移被夹紧为 0', () => {
    const rect = toImageRect({ x: -5, y: -1, width: 10, height: 8 }, 2, 1920, 1080)
    expect(rect.x).toBe(0)
    expect(rect.y).toBe(0)
    expect(rect.width).toBe(10) // x1 = 5*2 = 10
    expect(rect.height).toBe(14) // y1 = 7*2 = 14
  })
})
