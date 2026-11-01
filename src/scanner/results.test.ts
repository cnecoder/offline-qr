import { describe, expect, it, vi } from 'vitest'
import { renderCard, renderResults, type ResultItem } from './results'

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

  it('pending 卡:显示识别中', () => {
    const card = renderCard(item({ state: 'pending', thumb: '' }))
    expect(card.querySelector('.card-msg')?.textContent).toBe('识别中…')
  })

  it('长文本默认折叠,点击展开/收起', () => {
    const pre = renderCard(item({ texts: ['x'.repeat(200)] })).querySelector('.result-text')!
    expect(pre.classList.contains('collapsed')).toBe(true)
    pre.dispatchEvent(new Event('click'))
    expect(pre.classList.contains('collapsed')).toBe(false)
    pre.dispatchEvent(new Event('click'))
    expect(pre.classList.contains('collapsed')).toBe(true)
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
