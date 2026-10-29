# QrTool · 二维码识别小工具

轻量、**完全离线**的二维码识别工具。v1 聚焦一件事:把图片二维码识别的体验做到最好。

- 识别 zxing-wasm(ZXing-C++ WASM),识别率优先,支持一图多码
- 三条输入路径:选择图片(多选)/ 拖拽到窗口 / **Ctrl+V 粘贴截图**
- 识别历史(本地 20 条,可回显、清空)
- 零网络请求:识别全程本地完成,不上传任何数据
- 双形态产物:Windows 桌面安装包(NSIS)+ 纯网页单文件 `dist/index.html`(双击即用)
- 界面简体中文,深浅色跟随系统;安装包仅约 2.2 MB

> 摄像头扫码与二维码生成不在 v1 范围,规划见 `docs/requirements.md` §6。

## 快速开始

```bash
npm install        # 安装依赖(Node ≥ 20)
npm run dev        # 开发模式(localhost)
npm run build      # 构建 → dist/index.html 单文件产物
npm run tauri dev  # 桌面窗口开发
npm run tauri build # 构建桌面安装包 → src-tauri/target/release/bundle/nsis/
```

> `tauri build` 首次运行需从 GitHub 下载 NSIS 工具包;若直连超时,请走本地代理:
> `HTTPS_PROXY=http://127.0.0.1:7897 npm run tauri build`(端口按实际代理调整)。

## 测试(自动化优先)

```bash
npm test   # 46 项单元/管线测试(Vitest + happy-dom)
npm run e2e # 9 项端到端测试(Playwright,含 file:// 直开与零网络请求断言)
```

- 单元/组件:历史去重上限、串行队列、URL 判定、结果渲染、ingest、引擎封装
- 识别管线:qrcode 生成样张(常规/中文/低分辨率/低量化抖动/反色/一图多码/空图)驱动真实 WASM 解码
- E2E:三条输入路径、一图三码、失败标注、历史回显与清空、file:// 直开、零网络请求断言
- 可测性约束与覆盖率门禁见 `docs/architecture.md` §8

## 文档

| 文档 | 内容 |
|---|---|
| [docs/requirements.md](docs/requirements.md) | 需求范围(v1 做与不做)、非功能目标、验收清单 |
| [docs/architecture.md](docs/architecture.md) | 双形态架构、识别管线、模块划分、测试策略、风险对策 |
| [docs/ui-design.md](docs/ui-design.md) | 布局、组件规格、视觉、窗口规格 |
| [task.md](task.md) | 任务跟踪与进度(唯一入口) |

## 技术栈

Tauri 2(Rust 壳,零业务代码)· Vite + TypeScript · zxing-wasm(Apache-2.0)· Vitest · Playwright

平台:Windows 先行开发与验证;Linux / macOS 为打磨后的适配目标(架构天然支持,macOS 构建需 macOS 环境或 CI)。
