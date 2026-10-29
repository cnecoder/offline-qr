import { describe, expect, it } from 'vitest'
import { createProgress, hideToast, showToast } from './status'

describe('createProgress', () => {
  it('show 显示进度文本,hide 复位', () => {
    const el = document.createElement('p')
    const progress = createProgress(el)
    progress.show('识别中 1/2…')
    expect(el.hidden).toBe(false)
    expect(el.textContent).toBe('识别中 1/2…')
    progress.hide()
    expect(el.hidden).toBe(true)
    expect(el.textContent).toBe('')
  })
})

describe('toast', () => {
  it('showToast 显示,hideToast 复位', () => {
    const el = document.createElement('div')
    showToast(el, '已复制')
    expect(el.hidden).toBe(false)
    expect(el.textContent).toBe('已复制')
    hideToast(el)
    expect(el.hidden).toBe(true)
    expect(el.textContent).toBe('')
  })
})
