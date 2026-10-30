import { describe, expect, it } from 'vitest'
import { contentSummary, contentToText, escapeVcard, escapeWifi } from './content'
import type { GenContent, VcardContent, WifiContent } from './content'

describe('escapeWifi', () => {
  it('转义 \\ ; , : 与双引号', () => {
    expect(escapeWifi('a;b,c:d"e\\f')).toBe('a\\;b\\,c\\:d\\"e\\\\f')
  })
  it('普通字符不变', () => {
    expect(escapeWifi('HomeNet-123')).toBe('HomeNet-123')
  })
})

describe('escapeVcard', () => {
  it('转义反斜杠/逗号/分号/换行', () => {
    expect(escapeVcard('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne')
    expect(escapeVcard('行1\r\n行2')).toBe('行1\\n行2')
  })
})

describe('contentToText · text', () => {
  it('返回去除首尾空白后的原文', () => {
    expect(contentToText({ kind: 'text', text: '  hello  ' })).toBe('hello')
  })
  it('空文本返回 null', () => {
    expect(contentToText({ kind: 'text', text: '   ' })).toBeNull()
  })
})

describe('contentToText · wifi', () => {
  const wifi: WifiContent = {
    kind: 'wifi',
    ssid: 'HomeNet',
    password: 'pass123',
    encryption: 'WPA',
    hidden: false,
  }
  it('标准 WIFI: 格式', () => {
    expect(contentToText(wifi)).toBe('WIFI:T:WPA;S:HomeNet;P:pass123;;')
  })
  it('隐藏网络追加 H:true', () => {
    expect(contentToText({ ...wifi, hidden: true })).toBe('WIFI:T:WPA;S:HomeNet;P:pass123;H:true;;')
  })
  it('nopass 省略密码段', () => {
    expect(contentToText({ ...wifi, encryption: 'nopass', password: '' })).toBe('WIFI:T:nopass;S:HomeNet;;')
  })
  it('WEP 保留密码段', () => {
    expect(contentToText({ ...wifi, encryption: 'WEP', password: 'abcde' })).toBe('WIFI:T:WEP;S:HomeNet;P:abcde;;')
  })
  it('SSID 与密码中的特殊字符被转义', () => {
    const tricky: WifiContent = { ...wifi, ssid: 'net;,"x', password: 'p:a,s\\s' }
    expect(contentToText(tricky)).toBe('WIFI:T:WPA;S:net\\;\\,\\"x;P:p\\:a\\,s\\\\s;;')
  })
  it('SSID 为空返回 null', () => {
    expect(contentToText({ ...wifi, ssid: '  ' })).toBeNull()
  })
})

describe('contentToText · vcard', () => {
  const vcard: VcardContent = {
    kind: 'vcard',
    name: '张三',
    mobile: '13800138000',
    phone: '',
    email: 'zhang@example.com',
    org: '示例公司',
    title: '工程师',
    url: 'https://example.com',
    address: '',
  }
  it('完整字段按序输出,空字段省略,CRLF 行结束', () => {
    expect(contentToText(vcard)).toBe(
      [
        'BEGIN:VCARD',
        'VERSION:3.0',
        'N:;张三;;;',
        'FN:张三',
        'ORG:示例公司',
        'TITLE:工程师',
        'TEL;TYPE=CELL:13800138000',
        'EMAIL:zhang@example.com',
        'URL:https://example.com',
        'END:VCARD',
      ].join('\r\n'),
    )
  })
  it('姓名缺失时以组织兜底,全空返回 null', () => {
    expect(contentToText({ ...vcard, name: '', mobile: '' })).toContain('FN:示例公司')
    const empty: VcardContent = { ...vcard, name: '', org: '', mobile: '', phone: '', email: '', title: '', url: '', address: '' }
    expect(contentToText(empty)).toBeNull()
  })
  it('字段值中的逗号/分号/换行被转义', () => {
    const c: GenContent = { ...vcard, name: '李,四;五', org: '' }
    const text = contentToText(c)!
    expect(text).toContain('FN:李\\,四\\;五')
  })
})

describe('contentSummary', () => {
  it('三种模式的单行摘要', () => {
    expect(contentSummary({ kind: 'text', text: ' hello ' })).toBe('hello')
    expect(contentSummary({ kind: 'wifi', ssid: 'Net', password: 'x', encryption: 'WPA', hidden: false })).toBe('Wi-Fi:Net')
    expect(contentSummary({ kind: 'vcard', name: '张三', mobile: '', phone: '', email: '', org: '', title: '', url: '', address: '' })).toBe('名片:张三')
  })
})
