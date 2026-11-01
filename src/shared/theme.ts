/** 配色主题:WinTab 同款双主题,中性基底共享、只换 accent(WinHop 配色全量照搬) */
export type ThemeId = 'black-green' | 'black-yellow'

export const THEME_KEY = 'qr.theme.v1'
export const DEFAULT_THEME: ThemeId = 'black-green'
const THEMES: ThemeId[] = ['black-green', 'black-yellow']

/** 非法值一律回退默认(存储被手改/损坏时兜底) */
export function normalizeTheme(value: unknown): ThemeId {
  return THEMES.includes(value as ThemeId) ? (value as ThemeId) : DEFAULT_THEME
}

export function getTheme(): ThemeId {
  try {
    return normalizeTheme(localStorage.getItem(THEME_KEY))
  } catch {
    return DEFAULT_THEME
  }
}

/** 仅应用主题到根元素(不落盘) */
export function applyTheme(theme: ThemeId): void {
  document.documentElement.dataset.theme = theme
}

/** 持久化并应用;返回实际生效的主题 */
export function setTheme(theme: ThemeId): ThemeId {
  const next = normalizeTheme(theme)
  try {
    localStorage.setItem(THEME_KEY, next)
  } catch {
    // 存储不可用(隐私模式等)时仅本次会话生效
  }
  applyTheme(next)
  return next
}
