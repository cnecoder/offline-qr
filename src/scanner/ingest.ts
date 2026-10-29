export interface ImageTask {
  id: string
  name: string
  bitmap: ImageBitmap
  /** 64×64 dataURL 缩略图,用于结果卡片 */
  thumb: string
}

export interface IngestDeps {
  /** Blob → 位图;默认 loadBitmap(含 EXIF 方向与降采样)。测试可注入 */
  createBitmap?: (blob: Blob) => Promise<ImageBitmap>
  /** 位图 → 缩略图 dataURL。测试可注入 */
  createThumb?: (bitmap: ImageBitmap) => Promise<string>
  /** 任务 id 工厂。测试可注入 */
  nextId?: () => string
}

/** 位图长边上限:超过则降采样,避免超大图拖垮解码 */
export const MAX_BITMAP_EDGE = 2048

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

type BitmapFactory = (
  source: Blob | ImageBitmap,
  options?: ImageBitmapOptions,
) => Promise<ImageBitmap>

/** 解码位图:按 EXIF 方向;超过 MAX_BITMAP_EDGE 的图降采样并关闭原图 */
export async function loadBitmap(
  source: Blob | ImageBitmap,
  impl: BitmapFactory = createImageBitmap,
): Promise<ImageBitmap> {
  const full = await impl(source, { imageOrientation: 'from-image' })
  const maxEdge = Math.max(full.width, full.height)
  if (maxEdge <= MAX_BITMAP_EDGE) return full
  const scale = MAX_BITMAP_EDGE / maxEdge
  const resized = await impl(full, {
    resizeWidth: Math.max(1, Math.round(full.width * scale)),
    resizeHeight: Math.max(1, Math.round(full.height * scale)),
    resizeQuality: 'medium',
  })
  full.close()
  return resized
}

const THUMB_SIZE = 64

async function defaultCreateThumb(bitmap: ImageBitmap): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = THUMB_SIZE
  canvas.height = THUMB_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, THUMB_SIZE, THUMB_SIZE)
  const scale = Math.min(THUMB_SIZE / bitmap.width, THUMB_SIZE / bitmap.height)
  const w = bitmap.width * scale
  const h = bitmap.height * scale
  ctx.drawImage(bitmap, (THUMB_SIZE - w) / 2, (THUMB_SIZE - h) / 2, w, h)
  return canvas.toDataURL('image/jpeg', 0.7)
}

/** 输入归一化:把 File/Blob 统一转为带缩略图的识别任务 */
export function createIngest(deps: IngestDeps = {}) {
  let counter = 0
  const createBitmap = deps.createBitmap ?? ((blob: Blob) => loadBitmap(blob))
  const createThumb = deps.createThumb ?? defaultCreateThumb
  const nextId = deps.nextId ?? (() => `img-${++counter}`)

  return {
    async fromBlob(blob: Blob, name: string): Promise<ImageTask> {
      const bitmap = await createBitmap(blob)
      const thumb = await createThumb(bitmap)
      return { id: nextId(), name, bitmap, thumb }
    },
  }
}
