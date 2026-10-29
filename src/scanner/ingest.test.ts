import { describe, expect, it, vi } from 'vitest'
import { createIngest, isImageFile, loadBitmap, MAX_BITMAP_EDGE } from './ingest'

function fakeBitmap(width: number, height: number): ImageBitmap {
  return { width, height, close: vi.fn() } as unknown as ImageBitmap
}

describe('isImageFile', () => {
  it('image/* 判定为图片', () => {
    expect(isImageFile({ type: 'image/png' } as File)).toBe(true)
  })

  it('非图片类型判定为假', () => {
    expect(isImageFile({ type: 'text/plain' } as File)).toBe(false)
  })

  it('空 type 判定为假', () => {
    expect(isImageFile({ type: '' } as File)).toBe(false)
  })
})

describe('loadBitmap', () => {
  it('小图直接返回,不触发缩放', async () => {
    const small = fakeBitmap(800, 600)
    const impl = vi.fn().mockResolvedValue(small)
    const out = await loadBitmap(new Blob(), impl)
    expect(out).toBe(small)
    expect(impl).toHaveBeenCalledTimes(1)
    expect(impl.mock.calls[0][1]).toEqual({ imageOrientation: 'from-image' })
  })

  it('横向超大图降采样到长边上限并关闭原图', async () => {
    const big = fakeBitmap(4096, 2048)
    const resized = fakeBitmap(MAX_BITMAP_EDGE, 1024)
    const impl = vi.fn().mockResolvedValueOnce(big).mockResolvedValueOnce(resized)
    const out = await loadBitmap(new Blob(), impl)
    expect(out).toBe(resized)
    expect(impl).toHaveBeenCalledTimes(2)
    expect(impl.mock.calls[1][1]).toMatchObject({ resizeWidth: 2048, resizeHeight: 1024 })
    expect(big.close).toHaveBeenCalledTimes(1)
  })

  it('竖向超大图同样按长边等比缩放', async () => {
    const big = fakeBitmap(1000, 4000)
    const resized = fakeBitmap(512, 2048)
    const impl = vi.fn().mockResolvedValueOnce(big).mockResolvedValueOnce(resized)
    await loadBitmap(new Blob(), impl)
    expect(impl.mock.calls[1][1]).toMatchObject({ resizeWidth: 512, resizeHeight: 2048 })
  })
})

describe('createIngest().fromBlob', () => {
  it('组装 ImageTask(id/名称/位图/缩略图)', async () => {
    const bitmap = fakeBitmap(100, 80)
    const ingest = createIngest({
      createBitmap: async () => bitmap,
      createThumb: async () => 'data:thumb',
      nextId: (() => {
        let n = 0
        return () => `id-${++n}`
      })(),
    })
    const task = await ingest.fromBlob(new Blob(), 'shot.png')
    expect(task).toEqual({ id: 'id-1', name: 'shot.png', bitmap, thumb: 'data:thumb' })
  })

  it('默认 id 工厂自增且唯一', async () => {
    const ingest = createIngest({
      createBitmap: async () => fakeBitmap(10, 10),
      createThumb: async () => '',
    })
    const first = await ingest.fromBlob(new Blob(), 'a.png')
    const second = await ingest.fromBlob(new Blob(), 'b.png')
    expect(first.id).not.toBe(second.id)
  })
})
