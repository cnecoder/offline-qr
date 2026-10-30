import { contentSummary, contentToText, type ContentKind, type GenContent } from './content'
import { checkScanability } from './scancheck'
import { copyPng, downloadPng, downloadSvg } from './export'
import { createGenHistoryStore } from './gen-history'
import { createMatrix, type EccLevel } from './matrix'
import { renderQrSvg } from './render-svg'
import { DEFAULT_STYLE, PRESETS, type QrStyle } from './style'

/** 生成面板装配:内容模板(文本/Wi-Fi/名片)+ 样式状态 ↔ 预览/自检/导出 + 生成历史 */
export function initGeneratePanel(): void {
  // 内容
  const modeButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('#gen-mode [data-mode]'))
  const textSectionEl = document.getElementById('gen-content-text') as HTMLElement
  const wifiSectionEl = document.getElementById('gen-content-wifi') as HTMLElement
  const vcardSectionEl = document.getElementById('gen-content-vcard') as HTMLElement
  const textEl = document.getElementById('gen-text') as HTMLTextAreaElement
  const wifiSsidEl = document.getElementById('gen-wifi-ssid') as HTMLInputElement
  const wifiPasswordEl = document.getElementById('gen-wifi-password') as HTMLInputElement
  const wifiEncryptionEl = document.getElementById('gen-wifi-encryption') as HTMLSelectElement
  const wifiHiddenEl = document.getElementById('gen-wifi-hidden') as HTMLInputElement
  const vNameEl = document.getElementById('gen-v-name') as HTMLInputElement
  const vMobileEl = document.getElementById('gen-v-mobile') as HTMLInputElement
  const vPhoneEl = document.getElementById('gen-v-phone') as HTMLInputElement
  const vEmailEl = document.getElementById('gen-v-email') as HTMLInputElement
  const vOrgEl = document.getElementById('gen-v-org') as HTMLInputElement
  const vTitleEl = document.getElementById('gen-v-title') as HTMLInputElement
  const vUrlEl = document.getElementById('gen-v-url') as HTMLInputElement
  const vAddressEl = document.getElementById('gen-v-address') as HTMLInputElement
  const eccEl = document.getElementById('gen-ecc') as HTMLSelectElement
  // 样式
  const shapeEl = document.getElementById('gen-shape') as HTMLSelectElement
  const eyeFrameEl = document.getElementById('gen-eye-frame') as HTMLSelectElement
  const eyeBallEl = document.getElementById('gen-eye-ball') as HTMLSelectElement
  const fgEl = document.getElementById('gen-fg') as HTMLInputElement
  const eyeFrameColorEl = document.getElementById('gen-eye-frame-color') as HTMLInputElement
  const eyeBallColorEl = document.getElementById('gen-eye-ball-color') as HTMLInputElement
  const bgEl = document.getElementById('gen-bg') as HTMLInputElement
  const bgTransparentEl = document.getElementById('gen-bg-transparent') as HTMLInputElement
  const gradientEl = document.getElementById('gen-gradient') as HTMLSelectElement
  const gradientExtraEl = document.getElementById('gen-gradient-extra') as HTMLElement
  const fg2El = document.getElementById('gen-fg2') as HTMLInputElement
  const rotEl = document.getElementById('gen-rot') as HTMLInputElement
  const marginEl = document.getElementById('gen-margin') as HTMLInputElement
  const marginVal = document.getElementById('gen-margin-val') as HTMLElement
  const logoFileEl = document.getElementById('gen-logo-file') as HTMLInputElement
  const logoThumbEl = document.getElementById('gen-logo-thumb') as HTMLImageElement
  const logoRemoveEl = document.getElementById('gen-logo-remove') as HTMLButtonElement
  const logoSizeEl = document.getElementById('gen-logo-size') as HTMLInputElement
  const logoSizeVal = document.getElementById('gen-logo-size-val') as HTMLElement
  const logoShapeEl = document.getElementById('gen-logo-shape') as HTMLSelectElement
  const exportSizeEl = document.getElementById('gen-export-size') as HTMLInputElement
  const exportSizeVal = document.getElementById('gen-export-size-val') as HTMLElement
  const presetsEl = document.getElementById('gen-presets') as HTMLElement
  const previewEl = document.getElementById('gen-preview') as HTMLElement
  const badgeEl = document.getElementById('gen-scan-badge') as HTMLElement
  const pngEl = document.getElementById('gen-png') as HTMLButtonElement
  const svgEl = document.getElementById('gen-svg') as HTMLButtonElement
  const copyEl = document.getElementById('gen-copy') as HTMLButtonElement
  const statusEl = document.getElementById('gen-status') as HTMLElement
  // 生成历史
  const historyToggle = document.getElementById('gen-history-toggle') as HTMLButtonElement
  const historyClear = document.getElementById('gen-history-clear') as HTMLButtonElement
  const historyList = document.getElementById('gen-history-list') as HTMLUListElement

  const genHistory = createGenHistoryStore({ storage: localStorage })
  let style: QrStyle = structuredClone(DEFAULT_STYLE)
  let mode: ContentKind = 'text'
  let lastSvg = ''
  let matrix: ReturnType<typeof createMatrix> | null = null
  let historyOpen = false
  let renderTimer: number | undefined
  let scanTimer: number | undefined
  let statusTimer: number | undefined

  function showStatus(message: string, isError = false): void {
    window.clearTimeout(statusTimer)
    statusEl.textContent = message
    statusEl.classList.toggle('error', isError)
    if (!isError && message) {
      statusTimer = window.setTimeout(() => {
        statusEl.textContent = ''
      }, 2500)
    }
  }

  // ---- 内容模式 ----
  function setMode(next: ContentKind): void {
    mode = next
    for (const button of modeButtons) {
      const active = button.dataset.mode === next
      button.classList.toggle('active', active)
      button.setAttribute('aria-selected', String(active))
    }
    textSectionEl.hidden = next !== 'text'
    wifiSectionEl.hidden = next !== 'wifi'
    vcardSectionEl.hidden = next !== 'vcard'
  }
  for (const button of modeButtons) {
    button.addEventListener('click', () => {
      setMode(button.dataset.mode as ContentKind)
      render()
    })
  }

  function readContent(): GenContent {
    if (mode === 'wifi') {
      return {
        kind: 'wifi',
        ssid: wifiSsidEl.value,
        password: wifiPasswordEl.value,
        encryption: wifiEncryptionEl.value as WifiFields['encryption'],
        hidden: wifiHiddenEl.checked,
      }
    }
    if (mode === 'vcard') {
      return {
        kind: 'vcard',
        name: vNameEl.value,
        mobile: vMobileEl.value,
        phone: vPhoneEl.value,
        email: vEmailEl.value,
        org: vOrgEl.value,
        title: vTitleEl.value,
        url: vUrlEl.value,
        address: vAddressEl.value,
      }
    }
    return { kind: 'text', text: textEl.value }
  }

  function applyContent(content: GenContent): void {
    if (content.kind === 'text') {
      setMode('text')
      textEl.value = content.text
      return
    }
    if (content.kind === 'wifi') {
      setMode('wifi')
      wifiSsidEl.value = content.ssid
      wifiPasswordEl.value = content.password
      wifiEncryptionEl.value = content.encryption
      wifiHiddenEl.checked = content.hidden
      wifiPasswordEl.disabled = content.encryption === 'nopass'
      return
    }
    setMode('vcard')
    vNameEl.value = content.name
    vMobileEl.value = content.mobile
    vPhoneEl.value = content.phone
    vEmailEl.value = content.email
    vOrgEl.value = content.org
    vTitleEl.value = content.title
    vUrlEl.value = content.url
    vAddressEl.value = content.address
  }

  // ---- 生成历史 ----
  function renderGenHistory(): void {
    const entries = genHistory.all()
    historyToggle.textContent = `最近生成(${entries.length})`
    historyToggle.setAttribute('aria-expanded', String(historyOpen))
    historyClear.hidden = entries.length === 0
    historyList.hidden = !historyOpen || entries.length === 0
    historyList.replaceChildren()
    for (const entry of entries) {
      const li = document.createElement('li')
      li.dataset.testid = 'gen-history-item'
      li.title = contentSummary(entry.content)
      const kind = document.createElement('span')
      kind.className = `kind-badge kind-${entry.content.kind}`
      kind.textContent = entry.content.kind === 'text' ? '文' : entry.content.kind === 'wifi' ? 'Wi' : '片'
      const text = document.createElement('span')
      text.className = 'history-text'
      text.textContent = contentSummary(entry.content)
      const time = document.createElement('span')
      time.className = 'history-time'
      time.textContent = formatTime(entry.at)
      li.append(kind, text, time)
      li.addEventListener('click', () => {
        applyContent(entry.content)
        render()
        showStatus('已恢复该次生成内容')
      })
      historyList.append(li)
    }
  }

  function recordHistory(content: GenContent): void {
    if (contentToText(content) === null) return
    genHistory.add(content)
    renderGenHistory()
  }

  historyToggle.addEventListener('click', () => {
    historyOpen = !historyOpen
    renderGenHistory()
  })
  historyClear.addEventListener('click', () => {
    if (window.confirm('确定清空全部生成历史?')) {
      genHistory.clear()
      renderGenHistory()
    }
  })

  // ---- 样式状态 ----
  function syncControls(): void {
    shapeEl.value = style.moduleShape
    eyeFrameEl.value = style.eyeFrameShape
    eyeBallEl.value = style.eyeBallShape
    fgEl.value = style.foreground
    eyeFrameColorEl.value = style.eyeFrameColor
    eyeBallColorEl.value = style.eyeBallColor
    bgEl.value = style.background === 'transparent' ? '#ffffff' : style.background
    bgTransparentEl.checked = style.background === 'transparent'
    bgEl.disabled = bgTransparentEl.checked
    gradientEl.value = style.gradient
    gradientExtraEl.hidden = style.gradient === 'none'
    fg2El.value = style.foreground2
    rotEl.value = String(style.gradientRotation)
    marginEl.value = String(style.margin)
    marginVal.textContent = String(style.margin)
    logoSizeEl.value = String(style.logo ? Math.round(style.logo.sizeRatio * 100) : 22)
    logoSizeVal.textContent = logoSizeEl.value
    logoShapeEl.value = style.logo?.shape ?? 'square'
  }

  function scheduleRender(): void {
    window.clearTimeout(renderTimer)
    renderTimer = window.setTimeout(render, 150)
  }

  function scheduleScan(): void {
    window.clearTimeout(scanTimer)
    badgeEl.hidden = false
    badgeEl.textContent = '检测中…'
    badgeEl.className = 'scan-badge checking'
    scanTimer = window.setTimeout(() => {
      void (async () => {
        if (!lastSvg) return
        try {
          const verdict = await checkScanability(lastSvg)
          badgeEl.textContent = verdict === 'ok' ? '✓ 可扫' : '⚠ 未识别,建议调整'
          badgeEl.className = verdict === 'ok' ? 'scan-badge ok' : 'scan-badge warn'
        } catch {
          badgeEl.textContent = '⚠ 检测失败'
          badgeEl.className = 'scan-badge warn'
        }
      })()
    }, 300)
  }

  function render(): void {
    const content = readContent()
    const text = contentToText(content)
    if (text === null) {
      matrix = null
      lastSvg = ''
      const emptyHint =
        mode === 'wifi' ? '填写 Wi-Fi 信息后自动生成' : mode === 'vcard' ? '填写名片信息后自动生成' : '输入内容后自动生成'
      previewEl.innerHTML = `<p class="gen-empty">${emptyHint}</p>`
      badgeEl.hidden = true
      pngEl.disabled = svgEl.disabled = copyEl.disabled = true
      return
    }
    try {
      matrix = createMatrix(text, eccEl.value as EccLevel)
    } catch {
      matrix = null
      lastSvg = ''
      previewEl.innerHTML = '<p class="gen-empty">内容过长,无法生成</p>'
      badgeEl.hidden = true
      pngEl.disabled = svgEl.disabled = copyEl.disabled = true
      return
    }
    lastSvg = renderQrSvg(matrix, style)
    previewEl.innerHTML = lastSvg
    pngEl.disabled = svgEl.disabled = copyEl.disabled = false
    scheduleScan()
  }

  const formatTime = (ts: number): string => {
    const d = new Date(ts)
    const pad = (n: number): string => String(n).padStart(2, '0')
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  // ---- 内容事件 ----
  textEl.addEventListener('input', scheduleRender)
  eccEl.addEventListener('change', render)
  wifiSsidEl.addEventListener('input', scheduleRender)
  wifiPasswordEl.addEventListener('input', scheduleRender)
  wifiEncryptionEl.addEventListener('change', () => {
    wifiPasswordEl.disabled = wifiEncryptionEl.value === 'nopass'
    render()
  })
  wifiHiddenEl.addEventListener('change', render)
  for (const el of [vNameEl, vMobileEl, vPhoneEl, vEmailEl, vOrgEl, vTitleEl, vUrlEl, vAddressEl]) {
    el.addEventListener('input', scheduleRender)
  }

  // ---- 样式事件 ----
  shapeEl.addEventListener('change', () => {
    style.moduleShape = shapeEl.value as QrStyle['moduleShape']
    render()
  })
  eyeFrameEl.addEventListener('change', () => {
    style.eyeFrameShape = eyeFrameEl.value as QrStyle['eyeFrameShape']
    render()
  })
  eyeBallEl.addEventListener('change', () => {
    style.eyeBallShape = eyeBallEl.value as QrStyle['eyeBallShape']
    render()
  })
  fgEl.addEventListener('input', () => {
    style.foreground = fgEl.value
    scheduleRender()
  })
  eyeFrameColorEl.addEventListener('input', () => {
    style.eyeFrameColor = eyeFrameColorEl.value
    scheduleRender()
  })
  eyeBallColorEl.addEventListener('input', () => {
    style.eyeBallColor = eyeBallColorEl.value
    scheduleRender()
  })
  bgEl.addEventListener('input', () => {
    style.background = bgEl.value
    scheduleRender()
  })
  bgTransparentEl.addEventListener('change', () => {
    style.background = bgTransparentEl.checked ? 'transparent' : bgEl.value
    bgEl.disabled = bgTransparentEl.checked
    render()
  })
  gradientEl.addEventListener('change', () => {
    style.gradient = gradientEl.value as QrStyle['gradient']
    gradientExtraEl.hidden = style.gradient === 'none'
    render()
  })
  fg2El.addEventListener('input', () => {
    style.foreground2 = fg2El.value
    scheduleRender()
  })
  rotEl.addEventListener('input', () => {
    style.gradientRotation = rotEl.valueAsNumber
    scheduleRender()
  })
  marginEl.addEventListener('input', () => {
    style.margin = Math.max(0, Math.min(8, Math.round(marginEl.valueAsNumber)))
    marginVal.textContent = String(style.margin)
    scheduleRender()
  })

  // ---- Logo ----
  logoFileEl.addEventListener('change', () => {
    const file = logoFileEl.files?.[0]
    logoFileEl.value = ''
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result)
      // Logo 挖孔消耗纠错容量:M 级通常扛不住,自动升级到 H
      if (eccEl.value !== 'H') {
        eccEl.value = 'H'
        showStatus('已切换至 H 级纠错(Logo 需要更高冗余)')
      }
      style.logo = {
        dataUrl,
        sizeRatio: Number(logoSizeEl.value) / 100,
        shape: logoShapeEl.value as 'square' | 'circle',
        padding: true,
      }
      logoThumbEl.src = dataUrl
      logoThumbEl.hidden = false
      logoRemoveEl.hidden = false
      render()
    }
    reader.readAsDataURL(file)
  })
  logoSizeEl.addEventListener('input', () => {
    logoSizeVal.textContent = logoSizeEl.value
    if (style.logo) {
      style.logo = { ...style.logo, sizeRatio: logoSizeEl.valueAsNumber / 100 }
      scheduleRender()
    }
  })
  logoShapeEl.addEventListener('change', () => {
    if (style.logo) {
      style.logo = { ...style.logo, shape: logoShapeEl.value as 'square' | 'circle' }
      render()
    }
  })
  logoRemoveEl.addEventListener('click', () => {
    style.logo = null
    logoThumbEl.hidden = true
    logoRemoveEl.hidden = true
    render()
  })

  // ---- 导出(成功即记录历史) ----
  exportSizeEl.addEventListener('input', () => {
    exportSizeVal.textContent = exportSizeEl.value
  })
  pngEl.addEventListener('click', () => {
    if (!lastSvg) return
    const content = readContent()
    void downloadPng(lastSvg, exportSizeEl.valueAsNumber, `qrcode-${Date.now()}.png`).then(() => {
      showStatus('已保存 PNG')
      recordHistory(content)
    })
  })
  svgEl.addEventListener('click', () => {
    if (!lastSvg) return
    const content = readContent()
    downloadSvg(lastSvg, `qrcode-${Date.now()}.svg`)
    showStatus('已保存 SVG')
    recordHistory(content)
  })
  copyEl.addEventListener('click', () => {
    if (!lastSvg) return
    const content = readContent()
    void copyPng(lastSvg, 512).then(ok => {
      showStatus(ok ? '已复制到剪贴板' : '复制失败', !ok)
      if (ok) recordHistory(content)
    })
  })

  // ---- 预设 ----
  PRESETS.forEach(preset => {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = preset.name
    button.addEventListener('click', () => {
      style = { ...structuredClone(DEFAULT_STYLE), ...structuredClone(preset.style) }
      syncControls()
      render()
      if (preset.name === '徽标款' && !style.logo) {
        showStatus('徽标款:在 Logo 组上传图片即可嵌入')
      }
    })
    presetsEl.append(button)
  })

  setMode('text')
  syncControls()
  render()
  renderGenHistory()
}

type WifiFields = { encryption: 'WPA' | 'WEP' | 'nopass' }
