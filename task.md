# QR 工具 · 任务跟踪(task.md)

> 本文档是本项目**唯一的**任务与进度跟踪入口。
> 规则:① 每完成一个特性/修复/文档,更新本文档并 commit;② 文档描述必须与实际实现保持一致;③ 需求、架构、UI 设计文档放在 docs/ 目录,本文档只做任务与进度索引。

## 项目定位

轻量、完全离线的二维码识别小工具。

- **平台策略**:Windows 优先开发与测试;Linux、macOS 为后期目标(桌面三端,不考虑移动端)
- **产品形态**:
  1. Tauri 2 桌面应用(主形态)
  2. 纯网页单文件版(`dist/index.html`,同一前端代码直接产出)
- **核心原则**:零网络请求,识别全部在本地完成,不上传任何数据
- **v1 策略**:**识别优先**——把二维码图片识别体验做到最好;生成模块整体后置

## 已定决策

| 日期 | 决策 | 结论 |
|---|---|---|
| 2026-10-29 | 平台 | Windows 先行,Linux/iOS 后期;要求保留三端通用的可能性 |
| 2026-10-30 | 技术栈 | Tauri 2(Rust 壳,零业务代码)+ Vite + TypeScript;构建产物同时含单文件 HTML |
| 2026-10-30 | 开发流程 | git 管理;每个特性/修复独立 commit;task.md 跟踪进度;文档与实现保持一致 |
| 2026-10-30 | **v1 范围** | **只做二维码识别(图片:选文件/拖拽/Ctrl+V 粘贴),识别体验做到最好;摄像头扫码与生成模块(配色/SVG/生成历史/Wi-Fi 模板)全部后期** |
| 2026-10-30 | 识别引擎 | zxing-wasm(识别率优先,支持一图多码;jsQR 弃用,qrcode 库仅作测试依赖) |
| 2026-10-30 | 批量与解析 | 支持多张批量识别;智能解析 v1 仅 URL + 纯文本 |
| 2026-10-30 | 平台修正 | 仅桌面端:Windows / Linux / macOS;不考虑 iOS 等移动端 |
| 2026-10-30 | 范围修正 | **摄像头扫码移出路线图(不做)**;全部功能先在 Windows 验证与打磨,完成后才适配 Linux/macOS |
| 2026-10-30 | 测试策略 | **自动化优先**:Vitest + happy-dom 单元/组件测试、qrcode 样张管线测试、Playwright E2E;覆盖率门禁 ≥80%;可测性设计约束见架构文档 §8 |

## 工作约定(每个会话必须遵守)

1. **控制与远程模型的交互频率**:减少轮次、批量执行工具调用、避免不必要的搜索与子代理(可能触发请求频率限制)。
2. **git 纪律**:每个特性开发、每个 bug 修复都必须有对应 commit,保证过程可追溯、可回溯。commit message 使用 `feat:` / `fix:` / `docs:` / `chore:` / `refactor:` 前缀。
3. **task.md 同步**:进度变化必须同步到本文档;发现文档与实现不一致,第一步是修齐文档。
4. **开发顺序**:需求文档 → 架构设计 → UI 设计 → 开发计划,全部定稿后再动手编码。

## 开发计划(commit 粒度)

| # | commit | 内容 | 状态 |
|---|---|---|---|
| 1 | `feat: project skeleton` | Tauri 2 + Vite 骨架、应用图标、可运行空壳;Vitest 测试基座(含首个示例测试) | ✔ 已完成(cargo check 通过;单文件产物 dist 仅 1 个 HTML) |
| 2 | `feat: recognition engine` | decode/engine/worker 接入 zxing-wasm;qrcode 样张管线测试(正常/低分辨率/低量化/反色/多码/空图)+ 引擎封装测试 | ✔ 已完成(17 项测试全过;wasm 内联打包验证随 #3 接线进行) |
| 3 | `feat: image ingestion` | 文件选择/拖拽/粘贴 → 串行队列;EXIF 方向、降采样、缩略图;ingest/queue 单元测试 | 待开始 |
| 4 | `feat: results UI` | results/status 渲染模块 + main 装配(三条输入路径→队列→引擎→卡片);渲染组件测试;浏览器实测粘贴识别通过;wasm 以 data URI 内联进单文件产物 | ✔ 已完成(39 项测试;浏览器端到端:粘贴→识别→卡片渲染,截图确认) |
| 5 | `feat: history` | 识别历史(去重置顶、上限 20、清空、回显);history 单元测试 | ✔ 已完成(46 项测试全过) |
| 6 | `feat: theme polish` | 深浅色、轻提示、空态、视觉细节 | ✔ 已并入 #4(CSS 与装配一次实现,浏览器截图确认) |
| 7 | `chore: desktop packaging` | NSIS 安装包构建通过 | ✔ 已完成(QrTool_0.1.0_x64-setup.exe,2.20 MiB;GitHub 下载超时已通过本地代理解决) |
| 8 | `test: e2e verification` | Playwright E2E + 需求 §7 验收清单核对 | ✔ 已完成(9 项 E2E 全过,含 file:// 直开与零网络断言) |
| 9 | `feat: screen region capture` | 屏幕选区识别:Rust 截屏命令(screenshots crate)+ 全屏遮罩选区窗 + 裁剪回传复用识别管线;选区状态机/坐标映射单测 | ✔ 已完成(56 项单测 + 9 项 E2E;真机截屏体验列入人工验证) |

每步完成后:勾选下方对应任务 + 更新本表状态 + commit。

## 分支策略(2026-10-30 起)

- **`v1.0.0` tag**:识别功能完整基线(图片识别 + 屏幕选区 + 历史;56 单测 + 9 E2E)
- **`recognition` 分支**:只有识别功能,**识别独立迭代线**——识别相关修复与体验优化在此进行并独立发布
- **`recognition-generation` 分支**:识别 + 生成,**生成功能开发线**——生成模块(含配色/SVG/模板/生成历史)在此分支按既有流程(需求→设计→实现)开发
- `main`:基线冻结点,作为两条线的共同祖先与合流参考
- 约定:在任一分支工作时,以该分支上的 task.md 为准继续同步进度;commit 纪律与工作约定不变

## CI / CD(待远程仓库创建后验证)

- `.github/workflows/ci.yml`:push / PR(main、recognition、recognition-generation)→ 单测 + 构建 + E2E(ubuntu,前端不需要 Rust)
- `.github/workflows/release.yml`:推送 `v*` tag → 三平台矩阵构建(Windows NSIS / Linux AppImage+deb / macOS dmg)→ tauri-action 自动创建 Release;含 tag↔version 一致性守卫
- 已同步到两条迭代分支(recognition 分支 cherry-pick);创建远程后 `git push origin main v1.0.0 recognition recognition-generation` 即触发验证

## 人工测试样张(2026-10-31)

- `scripts/gen-test-fixtures.mjs` 生成 13 张覆盖性样张至 `test_picture/fixtures/`:文本/中文/长文/Wi-Fi 转义/vCard/一图多码/低质量/反色/圆点彩色/小尺寸/Logo 图
- `npm run fixtures` 重新生成;`npm run verify:fixtures` 自动 QA 门禁(引擎回读,13/13 通过)
- 附人工测试清单 `test_picture/fixtures/index.md`;用户自己的截图放 `test_picture/` 根目录,互不干扰

## Windows 绿色版(2026-10-31)

- `scripts/make-portable.mjs`(`npm run portable`):单 exe(静态链接 WebView2Loader,零 dll 依赖)+ 使用说明 → zip,输出至 `src-tauri/target/release/bundle/portable/`
- Release 工作流 Windows 任务已接入:每次发 tag 自动把绿色版 zip 上传到 Release 页
- 历史数据存于当前用户 WebView2 数据目录,不随 exe 迁移(使用说明中已注明)

## 阶段与任务

### Phase 0 · 需求与设计
- [x] 技术选型调研与确认(Tauri 2)
- [x] 需求方向讨论:v1 识别优先,生成与摄像头后置
- [x] 关键决策定稿:@zxing/wasm / 多张批量 / URL+文本
- [x] docs/requirements.md 需求文档
- [x] docs/architecture.md 架构设计文档
- [x] docs/ui-design.md UI 设计文档
- [x] 开发计划定稿(见上方"开发计划")

### Phase 1 · 项目骨架
- [x] git 仓库初始化
- [x] 计划 #1:骨架 + Vitest 测试基座(单文件构建通过、6 项单测通过、cargo check 通过)

### Phase 2 · 识别核心
- [x] 计划 #2:识别引擎(zxing-wasm)+ 样张管线测试
- [ ] 计划 #3:输入路径与队列(ingest/queue 模块 + 单元测试)
- [x] 计划 #4:结果 UI 与 main 装配(浏览器实测通过;wasm 内联打包验证通过;file:// 行为级验证放入 #8)
- [x] 计划 #5:识别历史
- [x] 计划 #6:视觉打磨(并入 #4 完成)

### Phase 3 · 桌面壳与打包
- [x] 计划 #7:NSIS 安装包(2.20 MiB)
- [x] 计划 #6:视觉打磨(并入 #4 完成)

### Phase 4 · 验证
- [x] 计划 #8:E2E(9 项)+ 验收清单自动化覆盖
- [ ] 唯一剩余人工项:NSIS 安装包安装/卸载体验(双击 QrTool_0.1.0_x64-setup.exe)

### 后期(不在 v1 范围)
- [ ] 生成模块:文本生成、参数调节、保存 PNG/复制
- [ ] 生成增强:配色自定义、导出 SVG、生成历史、Wi-Fi/vCard 模板
- [ ] Linux 适配
- [ ] macOS 适配(构建需 macOS 环境或 CI macOS runner)

## 变更记录

- 2026-10-30 初始化本文档;git 仓库建立;技术栈定为 Tauri 2。
- 2026-10-30 v1 范围定向:识别优先、生成与摄像头后置。
- 2026-10-30 关键决策定稿(@zxing/wasm、多张批量、URL+文本);需求/架构/UI 三份文档 v1.0 定稿;开发计划确定。
- 2026-10-30 平台修正:目标平台收敛为桌面三端(Windows/Linux/macOS),移除 iOS。
- 2026-10-30 摄像头扫码移出路线图;验证顺序定为 Windows 先行;确立自动化测试策略(可测性内建,应测尽测)。
- 2026-10-30 计划 #1 完成:Tauri 2 + Vite 骨架、图标、Vitest 基座;cargo check 通过;单文件产物验证 OK;识别引擎 npm 包名修正为 zxing-wasm。
- 2026-10-30 计划 #2 完成:decode/engine/worker 三层管线;17 项自动化测试(含真实 wasm 解码样张:常规/中文/低分辨率/低量化/反色/一图多码/空图)。
- 2026-10-30 计划 #3、#4 完成:ingest/queue/results/status 模块 + main 装配;39 项测试全过;浏览器实测粘贴识别链路成功(Worker + WASM + UI);单文件产物 1.31 MB,wasm 内联确认。
- 2026-10-30 计划 #5 完成:识别历史(去重置顶/上限/清空/回显),46 项测试全过;计划 #6 并入 #4;启动 #7 NSIS 打包。
- 2026-10-30 **v1 全部 8 步计划完成**:46 项单测 + 9 项 E2E 全绿;NSIS 安装包 2.20 MiB;file:// 直开与零网络请求均自动化验证;剩余唯一人工项为安装/卸载体验。
- 2026-10-30 UI 重设计(v1.1):紧凑小窗口(720×540)密度优先布局——一行式输入条、主内容区充满并内部滚动、历史上浮面板、移除页脚;46 单测 + 9 E2E 回归全过;安装包重打同步新界面。
- 2026-10-30 计划 #9 屏幕选区识别完成:FR-7 落地(Rust 截屏 + 遮罩选区 + 管线复用),选区数学纯函数单测;56 单测 + 9 E2E 全绿;真机截屏体验待人工验证。
- 2026-10-30 版本升至 **v1.0.0** 并打 tag;建立双迭代分支:`recognition`(仅识别)与 `recognition-generation`(识别+生成),main 冻结为基线参考。
- 2026-10-30 配置 GitHub Actions:CI(push/PR 测试)与 Release(tag → 三平台产物)两套工作流;待远程仓库创建后验证。
- 2026-10-31 新增人工测试样张:`scripts/gen-test-fixtures.mjs` + `verify-fixtures.mjs`(13 张样张,引擎回读 QA 全过);AGENTS.md 技术栈描述修正为 zxing-wasm。
