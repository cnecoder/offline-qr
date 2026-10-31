// 打包 Windows 绿色版(免安装):单 exe + 使用说明 → zip
// 前置:npm run tauri build 已产出 src-tauri/target/release/qr-tool.exe
// 用法:npm run portable
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const version = JSON.parse(readFileSync(join(ROOT, 'src-tauri/tauri.conf.json'), 'utf8')).version
const stageName = `QrTool_${version}_portable_x64`
const bundleDir = join(ROOT, 'src-tauri', 'target', 'release', 'bundle', 'portable')
const stageDir = join(bundleDir, stageName)
const zipPath = join(bundleDir, `${stageName}.zip`)
const srcExe = join(ROOT, 'src-tauri', 'target', 'release', 'qr-tool.exe')

const readme = `QrTool v${version} 绿色版(免安装)
================================
1. 解压后直接运行 QrTool.exe,无需安装、不写注册表。
2. 依赖系统 WebView2 运行时(Windows 10/11 通常已内置);若启动时提示缺少 WebView2,
   请安装 Evergreen 运行时:https://developer.microsoft.com/microsoft-edge/webview2/
3. 完全离线运行,不上传任何数据。识别历史与生成历史保存在本机当前用户的
   WebView2 用户数据目录(%LOCALAPPDATA% 下),不随 exe 移动;换机器历史不迁移。
4. 与安装版功能完全一致;升级时用新版 QrTool.exe 覆盖旧文件即可。
`

rmSync(stageDir, { recursive: true, force: true })
mkdirSync(stageDir, { recursive: true })
copyFileSync(srcExe, join(stageDir, 'QrTool.exe'))
writeFileSync(join(stageDir, '使用说明.txt'), readme, 'utf8')

const result = spawnSync(
  'powershell',
  ['-NoProfile', '-Command', `Compress-Archive -Path "${stageDir}" -DestinationPath "${zipPath}" -Force`],
  { stdio: 'inherit' },
)
if (result.status !== 0) {
  console.error('压缩失败')
  process.exit(1)
}
console.log(`portable → ${zipPath}`)
