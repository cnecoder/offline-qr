# 项目工作约定

本项目开发遵循以下约定(完整版见 task.md):

1. **交互频率**:控制与远程模型的交互次数;批量执行工具调用、减少轮次;避免不必要的网络搜索与子代理(可能触发请求频率限制)。
2. **git 纪律**:每个特性、每个 bug 修复必须独立 commit(message 前缀 `feat:` / `fix:` / `docs:` / `chore:` / `refactor:`),保证开发过程可追溯、可回溯。
3. **单一跟踪文档**:任务与进度统一在 `task.md` 跟进,进度变化必须同步更新;文档描述与实现保持一致。
4. **开发顺序**:先 `docs/requirements.md` → `docs/architecture.md` → `docs/ui-design.md` → 开发计划,定稿后再编码。
5. **影响面测试**:每次修改先评估影响面、只跑相关测试;**推送远程之前必须全量**(npm test + build + e2e)。
6. **Release 纪律**:release 版本不本地编译;仅用户明确要求发布时打 tag 推送,触发远程 Release 构建。
7. **覆盖率复盘**:每个线上问题必须复盘"为什么测试没拦住",补测试或记入盲区清单(架构文档 §8)。
8. **技术栈**:Tauri 2(Rust 壳)+ Vite + TypeScript;二维码生成 `qrcode` + 自研 SVG 渲染器,识别 `zxing-wasm`;完全离线,零网络请求,不上传任何数据。
9. **进度基线**:以 `task.md` 当前进度为准(基线 v1.0.0 识别版,`recognition-generation` 分支含生成);设计文档变更先行。
