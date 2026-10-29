import { describe, expect, it } from 'vitest'
import { createSelection, normalizeRect } from './selection'

describe('normalizeRect', () => {
  it('反向拖拽也归一化为正矩形', () => {
    expect(normalizeRect({ x: 100, y: 80 }, { x: 30, y: 20 })).toEqual({
      x: 30,
      y: 20,
      width: 70,
      height: 60,
    })
  })

  it('零尺寸矩形', () => {
    expect(normalizeRect({ x: 5, y: 5 }, { x: 5, y: 5 })).toEqual({
      x: 5,
      y: 5,
      width: 0,
      height: 0,
    })
  })
})

describe('createSelection', () => {
  it('拖拽流程:begin → update → end 返回归一化矩形', () => {
    const selection = createSelection()
    expect(selection.dragging).toBe(false)
    selection.begin({ x: 50, y: 60 })
    expect(selection.dragging).toBe(true)
    selection.update({ x: 10, y: 20 })
    selection.update({ x: 120, y: 90 })
    expect(selection.rect()).toEqual({ x: 50, y: 60, width: 70, height: 30 })
    expect(selection.end()).toEqual({ x: 50, y: 60, width: 70, height: 30 })
    expect(selection.dragging).toBe(false)
    expect(selection.rect()).toBeNull()
  })

  it('未拖拽(end 时尺寸为 0)返回 null', () => {
    const selection = createSelection()
    selection.begin({ x: 10, y: 10 })
    expect(selection.end()).toBeNull()
  })

  it('小于最小尺寸的选区视为取消', () => {
    const selection = createSelection(4)
    selection.begin({ x: 10, y: 10 })
    selection.update({ x: 12, y: 50 }) // 宽 2 < 4
    expect(selection.end()).toBeNull()

    selection.begin({ x: 10, y: 10 })
    selection.update({ x: 40, y: 13 }) // 高 3 < 4
    expect(selection.end()).toBeNull()

    selection.begin({ x: 10, y: 10 })
    selection.update({ x: 40, y: 50 })
    expect(selection.end()).toEqual({ x: 10, y: 10, width: 30, height: 40 })
  })

  it('end 后再 begin 开启新一轮选区', () => {
    const selection = createSelection()
    selection.begin({ x: 0, y: 0 })
    selection.update({ x: 50, y: 50 })
    selection.end()
    selection.begin({ x: 100, y: 100 })
    selection.update({ x: 160, y: 140 })
    expect(selection.end()).toEqual({ x: 100, y: 100, width: 60, height: 40 })
  })
})
