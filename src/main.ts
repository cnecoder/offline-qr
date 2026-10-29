import './styles/style.css'
import { createEngine } from './scanner/engine'
import { createHistoryStore } from './scanner/history'
import { createIngest, isImageFile } from './scanner/ingest'
import { createSerialQueue } from './scanner/queue'
import { renderResults, type ResultItem } from './scanner/results'
import { createProgress, hideToast, showToast } from './shared/status'

const dropzone = document.getElementById('dropzone') as HTMLElement
const pickButton = document.getElementById('pick-button') as HTMLButtonElement
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

const items: ResultItem[] = []
let uidCounter = 0
let toastTimer: number | undefined

function refresh(): void {
  renderResults(resultsEl, items, { onCopy: handleCopy })
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
  try {
    const task = await ingest.fromBlob(file, file.name)
    const item = findItem(uid)
    if (item) item.thumb = task.thumb
    refresh()
    const texts = await engine.decode(task.bitmap)
    const target = findItem(uid)
    if (target) {
      target.state = texts.length > 0 ? 'done' : 'failed'
      target.texts = texts
    }
    if (texts.length > 0) {
      for (const text of texts) history.add(text)
      renderHistory()
    }
  } catch {
    const target = findItem(uid)
    if (target) target.state = 'failed'
  }
  refresh()
  refreshProgress()
}

function enqueueFiles(files: ArrayLike<File>): void {
  const all = Array.from(files)
  const images = all.filter(isImageFile)
  if (images.length === 0) {
    if (all.length > 0) flashToast('未发现图片文件')
    return
  }
  for (const file of images) {
    const uid = `item-${++uidCounter}`
    items.push({ id: uid, name: file.name, thumb: '', state: 'pending', texts: [] })
    refresh()
    void queue.add(() => decodeItem(uid, file))
  }
  refreshProgress()
}

// 输入路径 1:文件选择(可多选)
pickButton.addEventListener('click', () => fileInput.click())
fileInput.addEventListener('change', () => {
  if (fileInput.files && fileInput.files.length > 0) enqueueFiles(fileInput.files)
  fileInput.value = ''
})

// 输入路径 2:窗口级拖拽
for (const type of ['dragenter', 'dragover'] as const) {
  window.addEventListener(type, (event: DragEvent) => {
    event.preventDefault()
    dropzone.classList.add('dragging')
  })
}
window.addEventListener('dragleave', (event: DragEvent) => {
  if (event.relatedTarget === null) dropzone.classList.remove('dragging')
})
window.addEventListener('drop', (event: DragEvent) => {
  event.preventDefault()
  dropzone.classList.remove('dragging')
  if (event.dataTransfer?.files.length) enqueueFiles(event.dataTransfer.files)
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
    enqueueFiles(files)
  }
})

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
    li.addEventListener('click', () => recallEntry(entry.text))
    historyList.append(li)
  }
}

function recallEntry(text: string): void {
  items.unshift({
    id: `recall-${++recallCounter}`,
    name: '历史记录',
    thumb: '',
    state: 'done',
    texts: [text],
  })
  refresh()
  resultsEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

historyToggle.addEventListener('click', () => {
  historyOpen = !historyOpen
  renderHistory()
})
historyClear.addEventListener('click', () => {
  if (window.confirm('确定清空全部识别历史?')) {
    history.clear()
    renderHistory()
  }
})

renderHistory()
