// 入口分发:遮罩窗口(屏幕选区)与主窗口共用同一前端产物。
import './styles/style.css'

async function isOverlayWindow(): Promise<boolean> {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    return getCurrentWindow().label === 'region-overlay'
  } catch {
    // 浏览器环境(无 Tauri IPC):支持 ?overlay=1 直开调试
    return new URLSearchParams(window.location.search).has('overlay')
  }
}

void (async () => {
  if (await isOverlayWindow()) await import('./region/overlay')
  else await import('./app')
})()
