import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, test } from '@playwright/test'
import { pasteImage, qrPng, solidPng } from './helpers'

const RESULT_TEXT = '[data-testid="result-text"]'
const HISTORY_TOGGLE = /最近识别/

test.describe('二维码识别 · E2E(localhost)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: '二维码识别' })).toBeVisible()
  })

  test('页面加载:空态与关键元素齐全', async ({ page }) => {
    await expect(page.getByTestId('dropzone')).toBeVisible()
    await expect(page.getByTestId('empty-hint')).toBeVisible()
    await expect(page.getByRole('button', { name: HISTORY_TOGGLE })).toHaveText(/最近识别\(0\)/)
    // 浏览器形态:屏幕选区按钮隐藏(仅桌面版提供)
    await expect(page.getByTestId('region-button')).toBeHidden()
  })

  test('粘贴二维码截图:识别 URL 并提供复制', async ({ page }) => {
    await pasteImage(page, qrPng(['https://example.com/e2e-url']))
    await expect(page.locator(RESULT_TEXT)).toHaveText('https://example.com/e2e-url')
    await expect(page.getByTestId('copy-button')).toBeVisible()
    await expect(page.getByTestId('empty-hint')).toBeHidden()
    await expect(page.getByRole('button', { name: HISTORY_TOGGLE })).toHaveText(/最近识别\(1\)/)
  })

  test('一图多码:全部识别(验收标准:一图三码)', async ({ page }) => {
    const texts = ['https://multi.example.com/one', 'https://multi.example.com/two', 'https://multi.example.com/three']
    await pasteImage(page, qrPng(texts))
    await expect(page.locator(RESULT_TEXT)).toHaveCount(3)
    const seen = await page.locator(RESULT_TEXT).allTextContents()
    expect([...seen].sort()).toEqual([...texts].sort())
  })

  test('无二维码图片:明确标注失败,且不阻塞后续识别', async ({ page }) => {
    await pasteImage(page, solidPng())
    await expect(page.locator('.result-card.fail')).toBeVisible()
    await expect(page.locator('.result-card.fail')).toContainText('未识别到二维码')
    await pasteImage(page, qrPng(['https://example.com/after-fail']))
    await expect(page.locator(RESULT_TEXT)).toHaveText('https://example.com/after-fail')
  })

  test('识别历史:计数、展开、外部收起、回显、清空记录与历史', async ({ page }) => {
    await pasteImage(page, qrPng(['https://example.com/history-1']))
    await expect(page.locator(RESULT_TEXT)).toHaveText('https://example.com/history-1')

    await page.getByRole('button', { name: HISTORY_TOGGLE }).click()
    await expect(page.getByTestId('history-item')).toHaveCount(1)

    // 点击面板外部自动收起
    await page.getByTestId('dropzone').click()
    await expect(page.getByTestId('history-list')).toBeHidden()

    // 点击条目回显,面板自动收起
    await page.getByRole('button', { name: HISTORY_TOGGLE }).click()
    await page.getByTestId('history-item').first().click()
    await expect(page.locator(RESULT_TEXT).first()).toHaveText('https://example.com/history-1')
    await expect(page.getByTestId('history-list')).toBeHidden()

    // WebView2 无原生 confirm:清空为二次点击确认;结果卡片与历史一并清空
    await page.getByTestId('history-clear').click()
    await page.getByTestId('history-clear').click()
    await expect(page.getByRole('button', { name: /最近识别\(0\)/ })).toBeVisible()
    await expect(page.getByTestId('empty-hint')).toBeVisible()
  })

  test('文件选择对话框路径(多选)', async ({ page }) => {
    await page.setInputFiles('#file-input', [
      { name: 'picker-1.png', mimeType: 'image/png', buffer: qrPng(['https://example.com/via-picker-1']) },
      { name: 'picker-2.png', mimeType: 'image/png', buffer: qrPng(['https://example.com/via-picker-2']) },
    ])
    await expect(page.locator(RESULT_TEXT)).toHaveCount(2)
    await expect(page.locator(RESULT_TEXT).first()).toContainText('via-picker')
  })

  test('拖拽图片到窗口路径', async ({ page }) => {
    await page.evaluate(({ base64 }) => {
      const bin = atob(base64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      const dt = new DataTransfer()
      dt.items.add(new File([bytes], 'dropped.png', { type: 'image/png' }))
      document.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true }))
    }, { base64: qrPng(['https://example.com/via-drop']).toString('base64') })
    await expect(page.locator(RESULT_TEXT)).toHaveText('https://example.com/via-drop')
  })

  test('零网络请求:加载与识别全程无外部请求', async ({ page }) => {
    const requests: string[] = []
    page.on('request', request => requests.push(request.url()))
    await pasteImage(page, qrPng(['https://example.com/offline']))
    await expect(page.locator(RESULT_TEXT)).toHaveText('https://example.com/offline')
    const external = requests.filter(url => !url.startsWith('http://localhost:4173'))
    expect(external).toEqual([])
  })

  test('配色主题:点击切换 黑绿 ↔ 黑黄 并持久化', async ({ page }) => {
    const html = page.locator('html')
    await expect(html).toHaveAttribute('data-theme', 'black-green')
    await page.getByRole('button', { name: /配色/ }).click()
    await expect(html).toHaveAttribute('data-theme', 'black-yellow')
    await page.reload()
    await expect(html).toHaveAttribute('data-theme', 'black-yellow')
    await page.getByRole('button', { name: /配色/ }).click()
    await expect(html).toHaveAttribute('data-theme', 'black-green')
  })

  test('结果卡片:识别完成自动全选,标注来源与精确时间', async ({ page }) => {
    await pasteImage(page, qrPng(['https://example.com/auto-select']))
    await expect(page.locator(RESULT_TEXT)).toHaveText('https://example.com/auto-select')
    // 识别完成默认全选文本块,可直接 Ctrl+C
    const selected = await page.evaluate(() => window.getSelection()?.toString() ?? '')
    expect(selected).toBe('https://example.com/auto-select')
    await expect(page.locator('.result-card.latest')).toHaveCount(1)
    // meta 行:时间在前(年月日 时:分:秒)、来源在后
    await expect(page.locator('.card-meta').first()).toHaveText(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} · 粘贴/)
  })
})

test.describe('二维码识别 · E2E(file:// 直开单文件产物)', () => {
  test('无需服务器:WASM 与 Worker 内联在 file:// 下完整工作', async ({ browser }) => {
    const fileUrl = pathToFileURL(path.resolve('./dist/index.html')).href
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto(fileUrl)
    await expect(page.getByRole('heading', { name: '二维码识别' })).toBeVisible()
    await pasteImage(page, qrPng(['https://example.com/file-uri']))
    await expect(page.locator(RESULT_TEXT)).toHaveText('https://example.com/file-uri', {
      timeout: 15_000,
    })
    await context.close()
  })
})
