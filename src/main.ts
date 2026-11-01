// 入口分发:遮罩窗口(屏幕选区)与主窗口共用同一前端产物。
import './styles/style.css'

import { log } from './shared/log'

async function isOverlayWindow(): Promise<boolean> {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    return getCurrentWindow().label.startsWith('region-overlay')
  } catch {
    // 浏览器环境(无 Tauri IPC):支持 ?overlay=1 直开调试
    return new URLSearchParams(window.location.search).has('overlay')
  }
}

// 全局异常兜底:未捕获异常/未处理 Promise 拒绝进入诊断日志
window.addEventListener('error', event => log('window', `未捕获异常:${event.message}`))
window.addEventListener('unhandledrejection', event => log('window', `未处理的 Promise 拒绝:${String(event.reason)}`))

void (async () => {
  if (await isOverlayWindow()) await import('./region/overlay')
  else await import('./app')
})()
