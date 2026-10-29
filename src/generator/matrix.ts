import QRCode from 'qrcode'

export type EccLevel = 'L' | 'M' | 'Q' | 'H'

export interface QrMatrix {
  size: number
  /** 行优先;非 0 = 深色模块 */
  data: Uint8Array
  get(x: number, y: number): boolean
}

/** 文本 → QR 矩阵;内容超出该纠错等级容量时抛错 */
export function createMatrix(text: string, ecc: EccLevel): QrMatrix {
  const qr = QRCode.create(text, { errorCorrectionLevel: ecc })
  const size = qr.modules.size
  const data = qr.modules.data as Uint8Array
  return {
    size,
    data,
    get(x: number, y: number): boolean {
      return data[y * size + x] !== 0
    },
  }
}
