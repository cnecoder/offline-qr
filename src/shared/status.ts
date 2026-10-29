/** 进度行:显示"识别中 n/N…" */
export function createProgress(el: HTMLElement) {
  return {
    show(text: string): void {
      el.textContent = text
      el.hidden = false
    },
    hide(): void {
      el.hidden = true
      el.textContent = ''
    },
  }
}

export function showToast(el: HTMLElement, message: string): void {
  el.textContent = message
  el.hidden = false
}

export function hideToast(el: HTMLElement): void {
  el.hidden = true
  el.textContent = ''
}
