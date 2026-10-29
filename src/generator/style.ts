export type ModuleShape = 'square' | 'rounded' | 'dot'
export type EyeShape = 'square' | 'rounded' | 'circle'
export type GradientType = 'none' | 'linear' | 'radial'

export interface LogoStyle {
  /** 图片 dataURL(仅接受 dataURL,避免 SVG 栅格化时画布污染) */
  dataUrl: string
  /** logo 宽度占整图(含留白)比例,0.15–0.30 */
  sizeRatio: number
  shape: 'square' | 'circle'
  /** logo 外圈额外留白(挖孔范围扩大一圈) */
  padding: boolean
}

export interface QrStyle {
  moduleShape: ModuleShape
  eyeFrameShape: EyeShape
  eyeBallShape: EyeShape
  foreground: string
  /** 渐变第二色(gradient 为 none 时忽略) */
  foreground2: string
  gradient: GradientType
  /** 线性渐变角度(度) */
  gradientRotation: number
  eyeFrameColor: string
  eyeBallColor: string
  /** 任意 CSS 颜色或 'transparent' */
  background: string
  /** 四周留白(模块数) */
  margin: number
  logo: LogoStyle | null
}

export const DEFAULT_STYLE: QrStyle = {
  moduleShape: 'square',
  eyeFrameShape: 'square',
  eyeBallShape: 'square',
  foreground: '#000000',
  foreground2: '#000000',
  gradient: 'none',
  gradientRotation: 45,
  eyeFrameColor: '#000000',
  eyeBallColor: '#000000',
  background: '#ffffff',
  margin: 4,
  logo: null,
}

export interface Preset {
  name: string
  style: Partial<QrStyle>
}

export const PRESETS: Preset[] = [
  {
    name: '经典',
    style: { moduleShape: 'square', eyeFrameShape: 'square', eyeBallShape: 'square', foreground: '#000000', eyeFrameColor: '#000000', eyeBallColor: '#000000', gradient: 'none', background: '#ffffff' },
  },
  {
    name: '靛蓝圆点',
    style: { moduleShape: 'dot', eyeFrameShape: 'rounded', eyeBallShape: 'circle', foreground: '#4f46e5', eyeFrameColor: '#4f46e5', eyeBallColor: '#4f46e5', gradient: 'none', background: '#ffffff' },
  },
  {
    name: '活力渐变',
    style: { moduleShape: 'rounded', eyeFrameShape: 'rounded', eyeBallShape: 'rounded', gradient: 'linear', foreground: '#4f46e5', foreground2: '#ec4899', gradientRotation: 45, eyeFrameColor: '#4f46e5', eyeBallColor: '#ec4899', background: '#ffffff' },
  },
  {
    name: '翡翠径向',
    style: { moduleShape: 'dot', eyeFrameShape: 'circle', eyeBallShape: 'circle', gradient: 'radial', foreground: '#059669', foreground2: '#a7f3d0', gradientRotation: 0, eyeFrameColor: '#059669', eyeBallColor: '#059669', background: '#ffffff' },
  },
  {
    name: '徽标款',
    style: { moduleShape: 'square', eyeFrameShape: 'square', eyeBallShape: 'square', foreground: '#1f2328', eyeFrameColor: '#1f2328', eyeBallColor: '#1f2328', gradient: 'none', background: '#ffffff', margin: 4 },
  },
]
