export type ResultState = 'pending' | 'done' | 'failed'

export interface ResultItem {
  id: string
  name: string
  thumb: string
  state: ResultState
  /** state=done 时的识别文本(一图多码为多条) */
  texts: string[]
  /** state=failed 时的真实原因(引擎异常等);缺省 = 解码正常但未发现二维码 */
  error?: string
}

export interface ResultRenderOptions {
  /** 复制文本时触发(剪贴板写入与提示由装配层处理) */
  onCopy?: (text: string) => void
  /** 最新完成识别的条目 id:对应卡片以强调色描边并带"最新"徽标 */
  latestId?: string
}

/** 全量重绘结果列表(列表规模小,无需增量更新) */
export function renderResults(
  container: HTMLElement,
  items: ResultItem[],
  options: ResultRenderOptions = {},
): void {
  container.replaceChildren()
  for (const item of items) container.append(renderCard(item, options))
}

export function renderCard(item: ResultItem, options: ResultRenderOptions = {}): HTMLElement {
  const card = document.createElement('article')
  card.className = item.state === 'failed' ? 'result-card fail' : 'result-card'
  const isLatest = item.state !== 'pending' && item.id === options.latestId
  if (isLatest) card.classList.add('latest')
  card.dataset.testid = `result-card-${item.id}`

  if (item.thumb) {
    const img = document.createElement('img')
    img.className = 'thumb'
    img.alt = item.name
    img.src = item.thumb
    card.append(img)
  }

  const body = document.createElement('div')
  body.className = 'card-body'
  if (item.state === 'pending') {
    body.append(message('识别中…'))
  } else {
    if (isLatest) body.append(latestChip())
    if (item.state === 'failed') {
      // 引擎异常时直接给出真实原因,避免误导用户去检查选区完整性
      body.append(
        message(
          item.error
            ? `识别异常:${item.error}`
            : '未识别到二维码(请确认选区完整包含二维码及其四周留白)',
        ),
      )
    } else {
      for (const text of item.texts) body.append(textRow(text, options))
    }
  }
  card.append(body)
  return card
}

/** 点击"全选":选中文本块全部内容,可直接 Ctrl+C */
function selectContents(el: HTMLElement): void {
  const range = document.createRange()
  range.selectNodeContents(el)
  const selection = window.getSelection()
  if (!selection) return
  selection.removeAllRanges()
  selection.addRange(range)
}

/** 单条文本行:文本块(独立底色,明确区分)+ 右侧 全选/复制 按钮列 */
function textRow(text: string, options: ResultRenderOptions): HTMLElement {
  const row = document.createElement('div')
  row.className = 'result-row'

  const pre = document.createElement('p')
  pre.className = 'result-text'
  pre.dataset.testid = 'result-text'
  pre.textContent = text
  if (text.length > COLLAPSE_LENGTH || text.includes('\n')) {
    pre.classList.add('collapsed')
    pre.addEventListener('click', () => pre.classList.toggle('collapsed'))
  }
  row.append(pre)

  const actions = document.createElement('div')
  actions.className = 'row-actions'
  const selectAll = document.createElement('button')
  selectAll.textContent = '全选'
  selectAll.dataset.testid = 'select-button'
  selectAll.addEventListener('click', () => selectContents(pre))
  const copy = document.createElement('button')
  copy.textContent = '复制'
  copy.className = 'copy-button'
  copy.dataset.testid = 'copy-button'
  copy.addEventListener('click', () => options.onCopy?.(text))
  actions.append(selectAll, copy)
  row.append(actions)
  return row
}

function latestChip(): HTMLElement {
  const chip = document.createElement('span')
  chip.className = 'latest-chip'
  chip.textContent = '最新'
  return chip
}

function message(text: string): HTMLElement {
  const p = document.createElement('p')
  p.className = 'card-msg'
  p.textContent = text
  return p
}

/** 超过该长度或含换行的文本默认折叠,点击展开 */
const COLLAPSE_LENGTH = 80
