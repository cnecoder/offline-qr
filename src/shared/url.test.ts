import { describe, expect, it } from 'vitest'
import { isHttpUrl } from './url'

describe('isHttpUrl', () => {
  it('识别 https 链接', () => {
    expect(isHttpUrl('https://example.com')).toBe(true)
  })

  it('识别 http 链接(带路径与参数)', () => {
    expect(isHttpUrl('http://example.com/a?b=1')).toBe(true)
  })

  it('大写协议也可识别', () => {
    expect(isHttpUrl('HTTPS://EXAMPLE.COM')).toBe(true)
  })

  it('非 http(s) 协议不算链接', () => {
    expect(isHttpUrl('ftp://example.com')).toBe(false)
    expect(isHttpUrl('javascript:alert(1)')).toBe(false)
  })

  it('普通文本与空串不算链接', () => {
    expect(isHttpUrl('hello world')).toBe(false)
    expect(isHttpUrl('')).toBe(false)
  })

  it('含空白的字符串不算链接', () => {
    expect(isHttpUrl('https://example.com/a b')).toBe(false)
  })
})
