import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { pasteImage, solidPng } from './helpers'

const TEXT = 'https://gen.example.com/qr'

test.describe('生成 Tab · 深度自定义与美化', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: '生成', exact: true }).click()
    await expect(page.getByTestId('panel-generate')).toBeVisible()
  })

  test('输入内容生成预览,可扫性徽章为"可扫"', async ({ page }) => {
    await page.fill('#gen-text', TEXT)
    await expect(page.locator('#gen-preview svg')).toBeVisible()
    await expect(page.getByTestId('scan-badge')).toHaveText(/✓ 可扫/, { timeout: 10_000 })
  })

  test('内容为空时导出按钮禁用,显示空态', async ({ page }) => {
    await expect(page.locator('#gen-preview svg')).toHaveCount(0)
    await expect(page.locator('#gen-png')).toBeDisabled()
    await expect(page.locator('.gen-empty')).toBeVisible()
  })

  test('切换模块形状与渐变,徽章保持可扫', async ({ page }) => {
    await page.fill('#gen-text', TEXT)
    await expect(page.getByTestId('scan-badge')).toHaveText(/✓ 可扫/, { timeout: 10_000 })
    await page.selectOption('#gen-shape', 'dot')
    await expect(page.locator('#gen-preview circle').first()).toBeAttached()
    await expect(page.getByTestId('scan-badge')).toHaveText(/✓ 可扫/, { timeout: 10_000 })
    await page.selectOption('#gen-gradient', 'linear')
    await expect(page.locator('#gen-preview svg linearGradient')).toHaveCount(1)
    await expect(page.getByTestId('scan-badge')).toHaveText(/✓ 可扫/, { timeout: 10_000 })
  })

  test('透明背景:预览无背景矩形,徽章可扫', async ({ page }) => {
    await page.fill('#gen-text', TEXT)
    await page.check('#gen-bg-transparent')
    await expect(page.locator('#gen-preview svg > rect[width]')).toHaveCount(0)
    await expect(page.getByTestId('scan-badge')).toHaveText(/✓ 可扫/, { timeout: 10_000 })
  })

  test('上传 Logo 后自动挖孔并保持可扫', async ({ page }) => {
    await page.fill('#gen-text', TEXT)
    await page.setInputFiles('#gen-logo-file', {
      name: 'logo.png',
      mimeType: 'image/png',
      buffer: solidPng(80, 80),
    })
    await expect(page.locator('#gen-preview svg image')).toHaveCount(1)
    await expect(page.getByTestId('scan-badge')).toHaveText(/✓ 可扫/, { timeout: 10_000 })
  })

  test('预设"活力渐变"一键应用', async ({ page }) => {
    await page.fill('#gen-text', TEXT)
    await page.getByRole('button', { name: '活力渐变' }).click()
    await expect(page.locator('#gen-preview svg linearGradient')).toHaveCount(1)
    await expect(page.getByTestId('scan-badge')).toHaveText(/✓ 可扫/, { timeout: 10_000 })
  })

  test('闭环:导出 PNG → 粘贴回识别管线 → 解码回读原文', async ({ page }) => {
    await page.fill('#gen-text', TEXT)
    await expect(page.getByTestId('scan-badge')).toHaveText(/✓ 可扫/, { timeout: 10_000 })
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('#gen-png')])
    const filePath = await download.path()
    expect(filePath).toBeTruthy()
    const png = readFileSync(filePath!)
    // 粘贴监听是全局的,在生成 Tab 内即可触发识别管线
    await pasteImage(page, png)
    await expect(page.locator('[data-testid="result-text"]')).toHaveText(TEXT, { timeout: 15_000 })
  })

  test('导出 SVG 内容良构', async ({ page }) => {
    await page.fill('#gen-text', TEXT)
    await expect(page.locator('#gen-preview svg')).toBeVisible()
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('#gen-svg')])
    const filePath = await download.path()
    expect(filePath).toBeTruthy()
    const content = readFileSync(filePath!, 'utf8')
    expect(content.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
    expect(content).toContain('</svg>')
    expect(content).toContain('data-eye="tl"')
  })
})
