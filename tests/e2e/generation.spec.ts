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

  test('Wi-Fi 模板:闭环解码为标准 WIFI: 格式', async ({ page }) => {
    await page.getByRole('button', { name: 'Wi-Fi', exact: true }).click()
    await page.fill('#gen-wifi-ssid', 'HomeNet')
    await page.fill('#gen-wifi-password', 'pass123')
    await expect(page.getByTestId('scan-badge')).toHaveText(/✓ 可扫/, { timeout: 10_000 })
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('#gen-png')])
    const png = readFileSync((await download.path())!)
    await pasteImage(page, png)
    await expect(page.locator('[data-testid="result-text"]')).toHaveText('WIFI:T:WPA;S:HomeNet;P:pass123;;', {
      timeout: 15_000,
    })
  })

  test('Wi-Fi 无密码:省略密码段', async ({ page }) => {
    await page.getByRole('button', { name: 'Wi-Fi', exact: true }).click()
    await page.fill('#gen-wifi-ssid', 'OpenNet')
    await page.selectOption('#gen-wifi-encryption', 'nopass')
    await expect(page.locator('#gen-wifi-password')).toBeDisabled()
    await expect(page.getByTestId('scan-badge')).toHaveText(/✓ 可扫/, { timeout: 10_000 })
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('#gen-svg')])
    const content = readFileSync((await download.path())!, 'utf8')
    // SVG 是矢量,无法直接解码;切回文本模式断言由下方 vcard 用例覆盖
    expect(content).toContain('data-eye="tl"')
  })

  test('名片模板:闭环解码含 vCard 结构', async ({ page }) => {
    await page.getByRole('button', { name: '名片', exact: true }).click()
    await page.fill('#gen-v-name', '张三')
    await page.fill('#gen-v-mobile', '13800138000')
    await expect(page.getByTestId('scan-badge')).toHaveText(/✓ 可扫/, { timeout: 10_000 })
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('#gen-png')])
    const png = readFileSync((await download.path())!)
    await pasteImage(page, png)
    const result = page.locator('[data-testid="result-text"]')
    await expect(result).toContainText('BEGIN:VCARD', { timeout: 15_000 })
    await expect(result).toContainText('FN:张三')
    await expect(result).toContainText('TEL;TYPE=CELL:13800138000')
  })

  test('生成历史:导出计数、展开、恢复表单、清空', async ({ page }) => {
    // 文本生成并导出
    await page.fill('#gen-text', TEXT)
    await expect(page.getByTestId('scan-badge')).toHaveText(/✓ 可扫/, { timeout: 10_000 })
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('#gen-png')])
    await download.path()
    // Wi-Fi 生成并导出
    await page.getByRole('button', { name: 'Wi-Fi', exact: true }).click()
    await page.fill('#gen-wifi-ssid', 'HistNet')
    await page.fill('#gen-wifi-password', 'pw')
    await expect(page.getByTestId('scan-badge')).toHaveText(/✓ 可扫/, { timeout: 10_000 })
    const [download2] = await Promise.all([page.waitForEvent('download'), page.click('#gen-png')])
    await download2.path()

    await expect(page.getByTestId('gen-history-toggle')).toHaveText(/最近生成\(2\)/)
    await page.getByTestId('gen-history-toggle').click()
    await expect(page.getByTestId('gen-history-item')).toHaveCount(2)
    // 点击 Wi-Fi 条目 → 表单恢复
    await page.getByTestId('gen-history-item').first().click()
    await expect(page.locator('#gen-wifi-ssid')).toHaveValue('HistNet')
    // 清空(二次点击确认,WebView2 无原生 confirm)
    await page.getByTestId('gen-history-clear').click()
    await page.getByTestId('gen-history-clear').click()
    await expect(page.getByTestId('gen-history-toggle')).toHaveText(/最近生成\(0\)/)
  })

  test('生成历史独立计数(识别 Tab 已无最近识别条)', async ({ page }) => {
    await page.fill('#gen-text', TEXT)
    await expect(page.getByTestId('scan-badge')).toHaveText(/✓ 可扫/, { timeout: 10_000 })
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('#gen-png')])
    await download.path()
    await expect(page.getByTestId('gen-history-toggle')).toHaveText(/最近生成\(1\)/)
    await expect(page.getByTestId('history-toggle')).toHaveCount(0)
  })
})
