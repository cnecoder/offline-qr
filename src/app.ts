import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { initGeneratePanel } from './generator/panel'
import { createEngine } from './scanner/engine'
import { createHistoryStore } from './scanner/history'
import { createIngest, isImageFile } from './scanner/ingest'
import { createSerialQueue } from './scanner/queue'
import { renderResults, selectTextContents, type ResultItem } from './scanner/results'
import { log } from './shared/log'
import { createProgress, hideToast, showToast } from './shared/status'
import { getTheme, setTheme } from './shared/theme'

log('app', `主窗启动(桌面:${'__TAURI_INTERNALS__' in window ? '是' : '否'})`)

// 双 Tab:识别 | 生成
const tabButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.tab[data-tab]'))
function switchTab(name: string): void {
  for (const button of tabButtons) {
    const active = button.dataset.tab === name
    button.classList.toggle('active', active)
    button.setAttribute('aria-selected', String(active))
  }
  ;(document.getElementById('panel-scan') as HTMLElement).hidden = name !== 'scan'
  ;(document.getElementById('panel-generate') as HTMLElement).hidden = name !== 'generate'
}
for (const button of tabButtons) {
  button.addEventListener('click', () => switchTab(button.dataset.tab ?? 'scan'))
}
switchTab('scan')
initGeneratePanel()

const appRoot = document.getElementById('app') as HTMLElement
const pickButton = document.getElementById('pick-button') as HTMLButtonElement
const regionButton = document.getElementById('region-button') as HTMLButtonElement
const fileInput = document.getElementById('file-input') as HTMLInputElement
const progressEl = document.getElementById('progress') as HTMLElement
const resultsEl = document.getElementById('results') as HTMLElement
const emptyHint = document.getElementById('empty-hint') as HTMLElement
const toastEl = document.getElementById('toast') as HTMLElement
const historyToggle = document.getElementById('history-toggle') as HTMLButtonElement
const historyClear = document.getElementById('history-clear') as HTMLButtonElement
const historyList = document.getElementById('history-list') as HTMLUListElement

const engine = createEngine()
const ingest = createIngest()
const queue = createSerialQueue()
const progress = createProgress(progressEl)
const history = createHistoryStore({ storage: localStorage })

// 配色主题:黑绿/黑黄切换,持久化到 localStorage(首帧前由 index.html 内联脚本应用)
const themeToggle = document.getElementById('theme-toggle') as HTMLButtonElement
function syncThemeButton(): void {
  themeToggle.textContent = getTheme() === 'black-yellow' ? '配色 黄' : '配色 绿'
}
themeToggle.addEventListener('click', () => {
  setTheme(getTheme() === 'black-yellow' ? 'black-green' : 'black-yellow')
  syncThemeButton()
})
syncThemeButton()

const items: ResultItem[] = []
let uidCounter = 0
// 识别结果纪元:清空时递增,在途识别结果据此作废(不再写入历史)
let itemsEpoch = 0
// 最新完成识别的条目:结果卡片着重显示
let latestDoneId = ''
let toastTimer: number | undefined

function refresh(): void {
  renderResults(resultsEl, items, { onCopy: handleCopy, latestId: latestDoneId })
  emptyHint.hidden = items.length > 0
}

function refreshProgress(): void {
  const total = items.length
  const done = items.filter(it => it.state !== 'pending').length
  if (done < total) progress.show(`识别中 ${done}/${total}…`)
  else progress.hide()
}

function flashToast(message: string): void {
  showToast(toastEl, message)
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => hideToast(toastEl), 2000)
}

async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // 降级到 execCommand
    }
  }
  const area = document.createElement('textarea')
  area.value = text
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.append(area)
  area.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  area.remove()
  return ok
}

function handleCopy(text: string): void {
  void copyToClipboard(text).then(ok => flashToast(ok ? '已复制' : '复制失败'))
}

function findItem(id: string): ResultItem | undefined {
  return items.find(it => it.id === id)
}

async function decodeItem(uid: string, file: File): Promise<void> {
  const t0 = performance.now()
  const epoch = itemsEpoch
  try {
    const task = await ingest.fromBlob(file, file.name)
    const item = findItem(uid)
    if (item) item.thumb = task.thumb
    refresh()
    log('scan', `位图就绪 ${task.bitmap.width}x${task.bitmap.height},预处理 ${Math.round(performance.now() - t0)}ms`)
    const texts = await engine.decode(task.bitmap)
    const target = findItem(uid)
    if (target) {
      target.state = texts.length > 0 ? 'done' : 'failed'
      target.texts = texts
      target.completedAt = Date.now()
      // 最新完成的卡片移到最前
      const idx = items.indexOf(target)
      if (idx > 0) {
        items.splice(idx, 1)
        items.unshift(target)
      }
    }
    latestDoneId = uid
    log('scan', `解码完成 ${Math.round(performance.now() - t0)}ms,结果 ${texts.length} 条`)
    // 清空已发生时丢弃迟到的识别结果,不再写入历史
    if (texts.length > 0 && epoch === itemsEpoch) {
      for (const text of texts) history.add(text)
      renderHistory()
    }
  } catch (err) {
    const target = findItem(uid)
    if (target) {
      target.state = 'failed'
      target.error = err instanceof Error ? err.message : String(err)
      target.completedAt = Date.now()
      const idx = items.indexOf(target)
      if (idx > 0) {
        items.splice(idx, 1)
        items.unshift(target)
      }
    }
    latestDoneId = uid
    log('scan', `识别失败:${err instanceof Error ? err.message : String(err)}`)
  }
  // 屏幕选区识别失败(异常或 0 结果):把裁剪样张落盘,便于核对引擎实际看到的内容
  const target = findItem(uid)
  if (target && target.state === 'failed' && file.name === '屏幕选区.png' && lastRegionPngBase64) {
    try {
      const path = await invoke<string>('dump_failed_region', { pngBase64: lastRegionPngBase64 })
      log('scan', `失败选区样张已保存:${path}`)
    } catch (err) {
      log('scan', `样张落盘失败:${String(err)}`)
    }
  }
  refresh()
  refreshProgress()
  // 识别成功后默认全选文本块,可直接 Ctrl+C 或点右侧复制
  if (target && target.state === 'done') {
    const el = resultsEl.querySelector<HTMLElement>('.result-card.latest .result-text')
    if (el) selectTextContents(el)
  }
}

function enqueueFiles(files: ArrayLike<File>, source: string): void {
  const all = Array.from(files)
  const images = all.filter(isImageFile)
  if (images.length === 0) {
    if (all.length > 0) flashToast('未发现图片文件')
    log('scan', `入队忽略:${all.length} 个文件均非图片`)
    return
  }
  log('scan', `入队 ${images.length} 张图片,来源 ${source}(忽略非图片 ${all.length - images.length} 个)`)
  for (const file of images) {
    const uid = `item-${++uidCounter}`
    items.push({ id: uid, name: file.name, thumb: '', state: 'pending', texts: [], source })
    refresh()
    void queue.add(() => decodeItem(uid, file))
  }
  refreshProgress()
}

// 输入路径 1:文件选择(可多选)
pickButton.addEventListener('click', () => fileInput.click())
fileInput.addEventListener('change', () => {
  if (fileInput.files && fileInput.files.length > 0) enqueueFiles(fileInput.files, '文件')
  fileInput.value = ''
})

// 输入路径 2:窗口级拖拽(高亮整窗)
for (const type of ['dragenter', 'dragover'] as const) {
  window.addEventListener(type, (event: DragEvent) => {
    event.preventDefault()
    appRoot.classList.add('dragging')
  })
}
window.addEventListener('dragleave', (event: DragEvent) => {
  if (event.relatedTarget === null) appRoot.classList.remove('dragging')
})
window.addEventListener('drop', (event: DragEvent) => {
  event.preventDefault()
  appRoot.classList.remove('dragging')
  if (event.dataTransfer?.files.length) enqueueFiles(event.dataTransfer.files, '拖动')
})

// 输入路径 3:粘贴截图
document.addEventListener('paste', (event: ClipboardEvent) => {
  const transferred = event.clipboardData?.items
  if (!transferred) return
  const files: File[] = []
  for (let i = 0; i < transferred.length; i++) {
    if (!transferred[i].type.startsWith('image/')) continue
    const file = transferred[i].getAsFile()
    if (file) files.push(file)
  }
  if (files.length > 0) {
    event.preventDefault()
    enqueueFiles(files, '粘贴')
  }
})

// 输入路径 4:屏幕选区(仅桌面版;浏览器无 Tauri IPC)
const isTauri = '__TAURI_INTERNALS__' in window
let lastRegionPngBase64 = ''
if (isTauri) {
  regionButton.hidden = false
  regionButton.addEventListener('click', () => {
    log('region', '发起屏幕选区')
    void invoke('start_capture').catch(err => {
      log('region', `start_capture 失败:${String(err)}`)
      flashToast('屏幕捕获失败')
    })
  })
  void listen<string>('region-captured', event => {
    lastRegionPngBase64 = event.payload
    log('region', `收到选区截图(base64 ${event.payload.length} 字符),进入识别管线`)
    const bin = atob(event.payload)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    enqueueFiles([new File([bytes], '屏幕选区.png', { type: 'image/png' })], '屏幕选区')
  })
}

// 识别历史:折叠面板 + 点击回显
let historyOpen = false
let recallCounter = 0

const pad = (n: number): string => String(n).padStart(2, '0')
function formatTime(ts: number): string {
  const d = new Date(ts)
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function renderHistory(): void {
  const entries = history.all()
  historyToggle.textContent = `最近识别(${entries.length})`
  historyToggle.setAttribute('aria-expanded', String(historyOpen))
  historyClear.hidden = entries.length === 0
  historyList.hidden = !historyOpen || entries.length === 0
  historyList.replaceChildren()
  for (const entry of entries) {
    const li = document.createElement('li')
    li.dataset.testid = 'history-item'
    li.title = entry.text
    const text = document.createElement('span')
    text.className = 'history-text'
    text.textContent = entry.text
    const time = document.createElement('span')
    time.className = 'history-time'
    time.textContent = formatTime(entry.at)
    li.append(text, time)
    li.addEventListener('click', () => {
      recallEntry(entry.text)
      historyOpen = false
      renderHistory()
    })
    historyList.append(li)
  }
}

function recallEntry(text: string): void {
  const rid = `recall-${++recallCounter}`
  latestDoneId = rid
  items.unshift({
    id: rid,
    name: '历史记录',
    thumb: '',
    state: 'done',
    texts: [text],
    source: '历史回显',
    completedAt: Date.now(),
  })
  refresh()
  resultsEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

historyToggle.addEventListener('click', () => {
  historyOpen = !historyOpen
  renderHistory()
})
// 点击面板外部任意处自动收起历史面板
document.addEventListener('pointerdown', event => {
  if (!historyOpen) return
  const node = event.target as Node
  if (historyList.contains(node) || historyToggle.contains(node) || historyClear.contains(node)) return
  historyOpen = false
  renderHistory()
})
// WebView2 默认禁用原生脚本对话框,window.confirm 恒返回 false(清空从未执行)——
// 改用应用内二次点击确认,3 秒未确认自动解除
let clearArmed = false
let clearArmTimer: number | undefined
function disarmHistoryClear(): void {
  clearArmed = false
  window.clearTimeout(clearArmTimer)
  historyClear.textContent = '清空'
  historyClear.classList.remove('danger')
}
historyClear.addEventListener('click', () => {
  if (!clearArmed) {
    clearArmed = true
    historyClear.textContent = '再点一次确认清空'
    historyClear.classList.add('danger')
    clearArmTimer = window.setTimeout(disarmHistoryClear, 3000)
    return
  }
  disarmHistoryClear()
  history.clear()
  // 结果卡片区即"识别记录":与历史一并清空回到空态;在途识别结果作废
  itemsEpoch++
  latestDoneId = ''
  items.length = 0
  refresh()
  refreshProgress()
  renderHistory()
  flashToast('已清空识别记录与历史')
})

renderHistory()
