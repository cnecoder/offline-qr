import { beforeEach, describe, expect, it } from 'vitest'
import { applyTheme, DEFAULT_THEME, getTheme, normalizeTheme, setTheme, THEME_KEY } from './theme'

describe('theme', () => {
  beforeEach(() => {
    localStorage.removeItem(THEME_KEY)
    applyTheme(DEFAULT_THEME)
  })

  it('normalizeTheme:仅接受两个合法值,其余回退黑绿', () => {
    expect(normalizeTheme('black-green')).toBe('black-green')
    expect(normalizeTheme('black-yellow')).toBe('black-yellow')
    expect(normalizeTheme('light')).toBe(DEFAULT_THEME)
    expect(normalizeTheme(null)).toBe(DEFAULT_THEME)
    expect(normalizeTheme(42)).toBe(DEFAULT_THEME)
  })

  it('getTheme:无存储/非法存储/存储异常均回退默认', () => {
    expect(getTheme()).toBe(DEFAULT_THEME)
    localStorage.setItem(THEME_KEY, 'nonsense')
    expect(getTheme()).toBe(DEFAULT_THEME)
    localStorage.setItem(THEME_KEY, 'black-yellow')
    expect(getTheme()).toBe('black-yellow')
  })

  it('setTheme:持久化并应用到根元素', () => {
    expect(setTheme('black-yellow')).toBe('black-yellow')
    expect(localStorage.getItem(THEME_KEY)).toBe('black-yellow')
    expect(document.documentElement.dataset.theme).toBe('black-yellow')
    setTheme('black-green')
    expect(document.documentElement.dataset.theme).toBe('black-green')
  })

  it('setTheme:非法输入归一化后生效', () => {
    // @ts-expect-error 故意传非法值验证归一化
    expect(setTheme('hot-pink')).toBe(DEFAULT_THEME)
  })
})
