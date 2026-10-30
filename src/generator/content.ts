export type ContentKind = 'text' | 'wifi' | 'vcard'

export interface TextContent {
  kind: 'text'
  text: string
}

export interface WifiContent {
  kind: 'wifi'
  ssid: string
  password: string
  encryption: 'WPA' | 'WEP' | 'nopass'
  hidden: boolean
}

export interface VcardContent {
  kind: 'vcard'
  name: string
  mobile: string
  phone: string
  email: string
  org: string
  title: string
  url: string
  address: string
}

export type GenContent = TextContent | WifiContent | VcardContent

/** Wi-Fi 配置字符串转义:规范要求 `\ ; , : "` 前加反斜杠 */
export function escapeWifi(value: string): string {
  return value.replace(/([\\;,:"])/g, '\\$1')
}

/** vCard 文本值转义:反斜杠、逗号、分号与换行 */
export function escapeVcard(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\r?\n/g, '\\n')
}

/**
 * 模板内容 → 二维码原文。
 * 返回 null 表示内容尚不完整或为空(不视为错误,面板显示空态即可)。
 */
export function contentToText(content: GenContent): string | null {
  switch (content.kind) {
    case 'text': {
      const text = content.text.trim()
      return text || null
    }
    case 'wifi': {
      const ssid = content.ssid.trim()
      if (!ssid) return null
      const parts: string[] = [`T:${content.encryption}`, `S:${escapeWifi(ssid)}`]
      if (content.encryption !== 'nopass') {
        parts.push(`P:${escapeWifi(content.password)}`)
      }
      if (content.hidden) parts.push('H:true')
      return `WIFI:${parts.join(';')};;`
    }
    case 'vcard': {
      const name = content.name.trim()
      const org = content.org.trim()
      const mobile = content.mobile.trim()
      const fullName = name || org || mobile
      if (!fullName) return null
      const lines: string[] = ['BEGIN:VCARD', 'VERSION:3.0', `N:;${escapeVcard(fullName)};;;`, `FN:${escapeVcard(fullName)}`]
      if (org) lines.push(`ORG:${escapeVcard(org)}`)
      if (content.title.trim()) lines.push(`TITLE:${escapeVcard(content.title.trim())}`)
      if (mobile) lines.push(`TEL;TYPE=CELL:${escapeVcard(mobile)}`)
      if (content.phone.trim()) lines.push(`TEL;TYPE=WORK:${escapeVcard(content.phone.trim())}`)
      if (content.email.trim()) lines.push(`EMAIL:${escapeVcard(content.email.trim())}`)
      if (content.url.trim()) lines.push(`URL:${escapeVcard(content.url.trim())}`)
      if (content.address.trim()) lines.push(`ADR;TYPE=WORK:;;${escapeVcard(content.address.trim())};;;;`)
      lines.push('END:VCARD')
      return lines.join('\r\n')
    }
  }
}

/** 历史条目摘要(单行) */
export function contentSummary(content: GenContent): string {
  switch (content.kind) {
    case 'text':
      return content.text.trim()
    case 'wifi':
      return `Wi-Fi:${content.ssid.trim()}`
    case 'vcard':
      return `名片:${content.name.trim() || content.org.trim() || content.mobile.trim()}`
  }
}

/** 内容是否为空(无有效输入) */
export function isContentEmpty(content: GenContent): boolean {
  return contentToText(content) === null
}
