# 架构设计(Architecture)

> 版本:v1.0,2026-10-30 定稿。
> 实现若偏离本文档:先改文档并 commit,再改代码。

## 1. 总览

**同一套 Web 核心,两种交付形态:**

```
            ┌────────────────────────────┐
            │    前端核心(src/, TS)       │
            │    识别管线 + UI + 历史      │
            └──────────┬─────────┬───────┘
            vite build │         │ tauri build
        ┌──────────────▼──┐  ┌───▼───────────────┐
        │ dist/index.html │  │  Tauri 2 桌面应用   │
        │ (单文件,浏览器直开) │  │  (WebView2 壳)     │
        └─────────────────┘  └───────────────────┘
```

v1 无任何 Rust 业务逻辑:Rust 壳只负责窗口与打包;识别、历史、UI 全部在前端完成。后期如需原生能力(摄像头等)再扩展 Tauri command。

## 2. 技术栈与依赖

| 层 | 选型 | 许可 |
|---|---|---|
| UI | 原生 TypeScript + DOM(项目规模不需要框架;后期复杂化再评估) | — |
| 构建 | Vite + TypeScript | MIT |
| 识别引擎 | @zxing/wasm(ZXing-C++ 官方 WASM 构建) | Apache-2.0 |
| 桌面壳 | Tauri 2(窗口/打包) | MIT / Apache-2.0 |
| 单文件产物 | vite-plugin-singlefile | MIT |
| 测试辅助 | qrcode(仅 devDep,为 smoke 测试生成样张) | MIT |

注:jsQR 不采用(引擎决策记录于 task.md 2026-10-30);`qrcode` 库仅为测试依赖,后期生成模块转正式依赖。

## 3. 目录结构(规划)

```
E:\Project\QR
├── docs/                      需求/架构/UI 文档
│   ├── requirements.md
│   ├── architecture.md
│   └── ui-design.md
├── scripts/
│   ├── gen-icon.mjs           应用图标生成(Node zlib 手写 PNG)
│   └── smoke-test.mjs         node 端识别管线自测
├── src/                       前端核心(TypeScript)
│   ├── main.ts                装配入口
│   ├── styles/style.css
│   ├── shared/status.ts       轻提示 / 进度行
│   └── scanner/
│       ├── engine.ts          Worker 封装:decodeBitmap()
│       ├── worker.ts          Worker 内:WASM 初始化 + 解码
│       ├── ingest.ts          File/Blob → ImageBitmap(+缩略图)
│       ├── results.ts         结果卡片渲染
│       └── history.ts         历史(localStorage)
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
├── src-tauri/                 Rust 壳(零业务代码)
│   ├── tauri.conf.json
│   ├── Cargo.toml
│   ├── build.rs
│   ├── src/{main.rs, lib.rs}
│   └── icons/
├── task.md                    进度跟踪(唯一)
└── AGENTS.md                  会话工作约定
```

## 4. 识别管线(核心数据流)

```
File / Blob
  → createImageBitmap(blob, { imageOrientation: 'from-image' })    // EXIF 方向
  → (Worker 内) 离屏 canvas 取 ImageData;长边 > 2048 先降采样
  → readBarcodes(imageData, { formats: ['QRCode'], tryHarder, tryRotate,
                               tryInvert, tryDownscale })
  → Barcode[](一图多码全部返回)
  → 主线程:结果卡片 / 历史
```

- **解码在 Web Worker**:Worker 以 `?worker&inline` 引入(构建期 base64 内联进产物,从设计上规避单文件模式下的分包问题);WASM 模块在 worker 内初始化一次并复用,主线程只做 UI,满足"批量不卡界面"。
- 输入统一抽象为 `ImageTask { id, bitmap, thumb }`,**队列串行**处理;单张失败不阻断队列。
- 解码参数固定开启 tryHarder / tryRotate / tryInvert / tryDownscale,以识别率为优先(延迟换准确)。

## 5. 前端模块职责

| 模块 | 职责 |
|---|---|
| main.ts | 装配:三种输入监听 → ingest → 队列 → 渲染 |
| scanner/engine.ts | Worker 生命周期与请求-响应封装;不可用时降级主线程解码 |
| scanner/worker.ts | WASM 初始化 + 单张解码 |
| scanner/ingest.ts | File/Blob → ImageBitmap(EXIF 方向)+ 64px 缩略图 |
| scanner/results.ts | 结果卡渲染、复制、打开链接、折叠展开 |
| scanner/history.ts | localStorage 读写、去重置顶、渲染 |
| shared/status.ts | 进度行与轻提示 |

## 6. 数据与存储

- 历史:`localStorage['qr.history.v1'] = [{ text, at }]`;同 text 置顶刷新时间;上限 20 条,超限淘汰最旧。
- 无其他持久化,无设置页。

## 7. 构建与形态差异

| 命令 | 用途 |
|---|---|
| `npm run dev` | vite dev server(localhost,日常开发) |
| `npm run build` | tsc 类型检查 + vite build + singlefile 内联 → `dist/index.html` |
| `npm run tauri dev` | 桌面窗口加载 dev server |
| `npm run tauri build` | NSIS 安装包 |
| `npm run smoke` | node 端识别管线自测 |

- Tauri conf:`frontendDist: ../dist`;CSP 仅本地源并允许 `wasm-unsafe-eval`;窗口规格见 UI 文档 §5。
- 形态差异:桌面版窗口即应用;单文件版 file:// 直开。
- **已知风险(随 #2 首次接入引擎时验证)**:file:// 下 WASM 实例化(Worker 内联已通过 `?worker&inline` 从设计上规避)。降级预案:WASM 走非 streaming 实例化;若 file:// 仍受限,单文件版注明需 localhost 访问,桌面版不受影响。

## 8. 测试策略(自动化优先)

原则:**应测尽测、可测性内建**;人工测试仅保留安装卸载等不可自动化项。

| 层 | 工具 | 覆盖内容 |
|---|---|---|
| 单元/组件 | Vitest + happy-dom | 历史去重/上限/清空、队列调度与错误隔离、URL 判定、结果卡片渲染、ingest 任务构建、状态提示 |
| 识别管线 | Vitest(node 环境,`qrcode` 生成样张) | 正常 / 缩放模糊 / 低量化抖动 / 反色 样张解码断言 |
| E2E | Playwright(Chromium) | 三条输入路径、多码展示、失败标注、历史回显、**零网络请求断言** |

**可测性设计约束**(编码时强制遵守):

1. 逻辑与 DOM 分离:历史、队列、URL 判定等均为纯函数/纯类
2. 副作用集中且可注入:localStorage、当前时间、计时器通过参数注入,测试可替换
3. 渲染函数式:`render(container, data)`,不依赖全局单例
4. 引擎单一边界:所有解码必经 `engine.ts`,mock 点唯一
5. DOM 断言使用 `data-testid`,禁止用样式/文案定位

覆盖率门禁:`vitest --coverage`,src 全局阈值 ≥ 80%(装配层 main.ts 与 worker.ts 除外)。

## 9. 风险与对策

| 风险 | 对策 |
|---|---|
| file:// 下 WASM 实例化受限 | 非 streaming 实例化;仍不行则单文件版注明 localhost 使用(Worker 内联风险已由 `?worker&inline` 从设计上规避) |
| @zxing/wasm API 与本文档有出入 | 以官方 README 为准,差异收敛在 engine.ts 一处适配 |
| 批量大图内存占用 | 队列串行 + ImageBitmap 即用即 close |
