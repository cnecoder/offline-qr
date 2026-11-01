import { describe, expect, it, vi } from 'vitest'
import { formatDateTime, renderCard, renderResults, type ResultItem } from './results'

function item(overrides: Partial<ResultItem> = {}): ResultItem {
  return { id: 't1', name: 'a.png', thumb: 'data:x', state: 'done', texts: ['hello'], ...overrides }
}

describe('renderCard', () => {
  it('done 卡:缩略图 + 文本 + 复制按钮', () => {
    const card = renderCard(item())
    expect(card.className).not.toContain('fail')
    expect(card.querySelector('.thumb')).toBeTruthy()
    expect(card.querySelectorAll('[data-testid="result-text"]')).toHaveLength(1)
    expect(card.querySelector('[data-testid="result-text"]')?.textContent).toBe('hello')
    expect(card.querySelector('[data-testid="copy-button"]')).toBeTruthy()
  })

  it('结果卡仅提供复制按钮,不再提供"打开链接"', () => {
    const card = renderCard(item({ texts: ['https://example.com'] }))
    expect(card.querySelector('[data-testid="open-link"]')).toBeNull()
    expect(card.querySelector('[data-testid="copy-button"]')).toBeTruthy()
  })

  it('一图多码渲染多条文本,各带复制按钮', () => {
    const card = renderCard(item({ texts: ['a', 'b'] }))
    expect(card.querySelectorAll('[data-testid="result-text"]')).toHaveLength(2)
    expect(card.querySelectorAll('[data-testid="copy-button"]')).toHaveLength(2)
  })

  it('failed 卡:灰显提示且无操作按钮', () => {
    const card = renderCard(item({ state: 'failed', texts: [] }))
    expect(card.className).toContain('fail')
    expect(card.querySelector('.card-msg')?.textContent).toContain('未识别到二维码')
    expect(card.querySelector('[data-testid="copy-button"]')).toBeNull()
    expect(card.querySelector('[data-testid="open-link"]')).toBeNull()
  })

  it('failed 卡带 error:显示真实原因而非选区引导', () => {
    const card = renderCard(item({ state: 'failed', texts: [], error: '识别引擎异常终止' }))
    expect(card.querySelector('.card-msg')?.textContent).toBe('识别异常:识别引擎异常终止')
  })

  it('done 卡:meta 行 时间在前、来源在后、"最新"徽标殿后', () => {
    const card = renderCard(
      item({ source: '屏幕选区', completedAt: new Date(2026, 10, 1, 18, 23, 45).getTime() }),
      { latestId: 't1' },
    )
    const meta = card.querySelector('.card-meta')!
    const text = meta.textContent ?? ''
    expect(text).toContain('2026-11-01 18:23:45')
    expect(text).toContain('屏幕选区')
    expect(text.indexOf('2026-11-01 18:23:45')).toBeLessThan(text.indexOf('屏幕选区'))
    expect(meta.lastElementChild?.className).toBe('latest-chip')
  })

  it('done 卡:文本默认单行(卡片等高)', () => {
    const card = renderCard(item({ texts: ['short'] }))
    expect(card.querySelector('.result-text')?.classList.contains('collapsed')).toBe(true)
  })

  it('pending 卡:无 meta 行', () => {
    expect(renderCard(item({ state: 'pending', texts: [] })).querySelector('.card-meta')).toBeNull()
  })

  it('formatDateTime:补零的 年-月-日 时:分:秒', () => {
    expect(formatDateTime(new Date(2026, 0, 2, 3, 4, 5).getTime())).toBe('2026-01-02 03:04:05')
  })

  it('pending 卡:显示识别中', () => {
    const card = renderCard(item({ state: 'pending', thumb: '' }))
    expect(card.querySelector('.card-msg')?.textContent).toBe('识别中…')
  })

  it('长文本默认折叠,点击单向展开(不与拖选冲突)', () => {
    const pre = renderCard(item({ texts: ['x'.repeat(200)] })).querySelector('.result-text')!
    expect(pre.classList.contains('collapsed')).toBe(true)
    pre.dispatchEvent(new Event('click'))
    expect(pre.classList.contains('collapsed')).toBe(false)
    pre.dispatchEvent(new Event('click'))
    expect(pre.classList.contains('collapsed')).toBe(false)
  })

  it('长文本展开后,点击文本块外任意位置收起', () => {
    const card = renderCard(item({ texts: ['y'.repeat(200)] }))
    document.body.append(card)
    const pre = card.querySelector('.result-text')!
    pre.dispatchEvent(new Event('click'))
    expect(pre.classList.contains('expanded')).toBe(true)
    const outside = document.createElement('div')
    document.body.append(outside)
    outside.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(pre.classList.contains('expanded')).toBe(false)
    expect(pre.classList.contains('collapsed')).toBe(true)
    card.remove()
    outside.remove()
  })

  it('Ctrl+A:光标在文本块内时只选中该块内容', () => {
    const card = renderCard(item({ texts: ['want this only'] }))
    document.body.append(card)
    const pre = card.querySelector('.result-text')!
    const selection = window.getSelection()!
    // 光标落在文本块内(塌陷选区,当前无选中内容)
    const caret = document.createRange()
    caret.setStart(pre.firstChild!, 0)
    caret.collapse(true)
    selection.removeAllRanges()
    selection.addRange(caret)
    expect(selection.toString()).toBe('')
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true, cancelable: true }),
    )
    expect(selection.toString()).toBe('want this only')
    card.remove()
  })

  it('点击复制按钮触发 onCopy 并携带文本', () => {
    const onCopy = vi.fn()
    const card = renderCard(item({ texts: ['want this'] }), { onCopy })
    ;(card.querySelector('[data-testid="copy-button"]') as HTMLButtonElement).click()
    expect(onCopy).toHaveBeenCalledWith('want this')
  })
})

describe('renderResults', () => {
  it('全量重绘,空列表清空容器', () => {
    const container = document.createElement('div')
    renderResults(container, [item(), item({ id: 't2' })])
    expect(container.children).toHaveLength(2)
    renderResults(container, [])
    expect(container.children).toHaveLength(0)
  })
})
