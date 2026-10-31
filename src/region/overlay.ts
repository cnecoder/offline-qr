import { invoke } from '@tauri-apps/api/core'
import { toImageRect } from './crop'
import { createSelection, type Rect } from './selection'

interface CaptureData {
  width: number
  height: number
  png_base64: string
}

const MIN_SIZE = 4

/** 遮罩窗口按 label 序号(region-overlay-<i>)对应各自的截屏数据 */
async function resolveIndex(): Promise<number> {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    const match = /(\d+)$/.exec(getCurrentWindow().label)
    return match ? Number(match[1]) : 0
  } catch {
    return 0
  }
}

/** 遮罩窗口:全屏显示截屏,拖拽选区后裁剪回传主窗 */
async function boot(): Promise<void> {
  let data: CaptureData | null = null
  try {
    data = await invoke<CaptureData | null>('get_capture', { index: await resolveIndex() })
  } catch {
    data = null
  }

  const root = document.createElement('div')
  root.className = 'overlay'
  if (!data) {
    root.textContent = '未获取到屏幕图像(请在应用内发起屏幕选区)'
    document.body.append(root)
    return
  }

  const image = document.createElement('img')
  image.className = 'overlay-image'
  image.src = `data:image/png;base64,${data.png_base64}`
  image.alt = '屏幕截图'

  const canvas = document.createElement('canvas')
  canvas.className = 'overlay-canvas'
  root.append(image, canvas)
  document.body.append(root)

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    void invoke('cancel_capture').catch(() => {})
    return
  }

  const selection = createSelection(MIN_SIZE)
  let dpr = window.devicePixelRatio || 1

  function redraw(): void {
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx!.clearRect(0, 0, window.innerWidth, window.innerHeight)
    ctx!.fillStyle = 'rgba(0, 0, 0, 0.35)'
    ctx!.fillRect(0, 0, window.innerWidth, window.innerHeight)
    const rect = selection.rect()
    if (rect) {
      ctx!.clearRect(rect.x, rect.y, rect.width, rect.height)
      ctx!.strokeStyle = '#818cf8'
      ctx!.lineWidth = 1.5
      ctx!.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.width - 1, rect.height - 1)
    }
  }

  function resize(): void {
    dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(window.innerWidth * dpr)
    canvas.height = Math.round(window.innerHeight * dpr)
    redraw()
  }

  async function finish(rect: Rect): Promise<void> {
    const current = data!
    const scale = current.width / window.innerWidth
    const imageRect = toImageRect(rect, scale, current.width, current.height)
    if (imageRect.width < 2 || imageRect.height < 2) {
      void invoke('cancel_capture').catch(() => {})
      return
    }
    const crop = document.createElement('canvas')
    crop.width = imageRect.width
    crop.height = imageRect.height
    const cropCtx = crop.getContext('2d')
    if (!cropCtx) {
      void invoke('cancel_capture').catch(() => {})
      return
    }
    cropCtx.drawImage(
      image,
      imageRect.x,
      imageRect.y,
      imageRect.width,
      imageRect.height,
      0,
      0,
      imageRect.width,
      imageRect.height,
    )
    const dataUrl = crop.toDataURL('image/png')
    const pngBase64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
    try {
      await invoke('finish_capture', { pngBase64 })
    } catch {
      // 主窗不在线等异常:窗口由用户关闭兜底
    }
  }

  const point = (event: PointerEvent) => ({ x: event.clientX, y: event.clientY })

  canvas.addEventListener('pointerdown', event => {
    canvas.setPointerCapture(event.pointerId)
    selection.begin(point(event))
    redraw()
  })
  canvas.addEventListener('pointermove', event => {
    if (!selection.dragging) return
    selection.update(point(event))
    redraw()
  })
  canvas.addEventListener('pointerup', event => {
    if (!selection.dragging) return
    selection.update(point(event))
    const rect = selection.end()
    redraw()
    if (rect) void finish(rect)
  })
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape') void invoke('cancel_capture').catch(() => {})
  })
  window.addEventListener('resize', resize)

  resize()
}

void boot()
