import { isHttpUrl } from '../shared/url'

export type ResultState = 'pending' | 'done' | 'failed'

export interface ResultItem {
  id: string
  name: string
  thumb: string
  state: ResultState
  /** state=done 时的识别文本(一图多码为多条) */
  texts: string[]
}

export interface ResultHandlers {
  /** 点击"复制"时触发(剪贴板写入与提示由装配层处理) */
  onCopy?: (text: string) => void
}

/** 全量重绘结果列表(列表规模小,无需增量更新) */
export function renderResults(
  container: HTMLElement,
  items: ResultItem[],
  handlers: ResultHandlers = {},
): void {
  container.replaceChildren()
  for (const item of items) container.append(renderCard(item, handlers))
}

export function renderCard(item: ResultItem, handlers: ResultHandlers = {}): HTMLElement {
  const card = document.createElement('article')
  card.className = item.state === 'failed' ? 'result-card fail' : 'result-card'
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
  } else if (item.state === 'failed') {
    body.append(message('未识别到二维码(请确认选区完整包含二维码及其四周留白)'))
  } else {
    for (const text of item.texts) body.append(textBlock(text, handlers))
  }
  card.append(body)
  return card
}

function message(text: string): HTMLElement {
  const p = document.createElement('p')
  p.className = 'card-msg'
  p.textContent = text
  return p
}

/** 超过该长度或含换行的文本默认折叠,点击展开 */
const COLLAPSE_LENGTH = 80

function textBlock(text: string, handlers: ResultHandlers): HTMLElement {
  const wrap = document.createElement('div')

  const pre = document.createElement('p')
  pre.className = 'result-text'
  pre.dataset.testid = 'result-text'
  pre.textContent = text
  if (text.length > COLLAPSE_LENGTH || text.includes('\n')) {
    pre.classList.add('collapsed')
    pre.addEventListener('click', () => pre.classList.toggle('collapsed'))
  }
  wrap.append(pre)

  const actions = document.createElement('div')
  actions.className = 'card-actions'

  const copy = document.createElement('button')
  copy.textContent = '复制'
  copy.dataset.testid = 'copy-button'
  copy.addEventListener('click', () => handlers.onCopy?.(text))
  actions.append(copy)

  if (isHttpUrl(text)) {
    const open = document.createElement('a')
    open.textContent = '打开链接'
    open.href = text
    open.target = '_blank'
    open.rel = 'noopener noreferrer'
    open.dataset.testid = 'open-link'
    actions.append(open)
  }

  wrap.append(actions)
  return wrap
}
