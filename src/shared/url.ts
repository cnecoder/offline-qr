/** 判断识别文本是否为可打开的 HTTP(S) 链接 */
export function isHttpUrl(text: string): boolean {
  return /^https?:\/\/\S+$/i.test(text)
}
