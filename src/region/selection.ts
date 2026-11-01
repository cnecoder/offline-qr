/** 从遮罩窗口 label 解析屏幕序号(region-overlay-2 → 2);非遮罩 label 返回 null */
export function overlayIndexFromLabel(label: string): number | null {
  const match = /^region-overlay-(\d+)$/.exec(label)
  return match ? Number(match[1]) : null
}

export interface Point {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** 把任意两点(含反向拖拽)归一化为正矩形 */
export function normalizeRect(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  }
}

export interface Selection {
  begin(point: Point): void
  update(point: Point): void
  /** 结束拖拽:选区达到最小尺寸则返回归一化矩形,否则 null */
  end(): Rect | null
  rect(): Rect | null
  readonly dragging: boolean
}

/** 选区状态机(纯逻辑,不依赖 DOM) */
export function createSelection(minSize = 4): Selection {
  let start: Point | null = null
  let current: Point | null = null
  let dragging = false

  function currentRect(): Rect | null {
    return start && current ? normalizeRect(start, current) : null
  }

  return {
    get dragging() {
      return dragging
    },
    begin(point) {
      start = point
      current = point
      dragging = true
    },
    update(point) {
      if (dragging) current = point
    },
    rect() {
      return currentRect()
    },
    end() {
      dragging = false
      const rect = currentRect()
      start = null
      current = null
      return rect && rect.width >= minSize && rect.height >= minSize ? rect : null
    },
  }
}
