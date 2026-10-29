# 项目工作约定

本项目开发遵循以下约定(完整版见 task.md):

1. **交互频率**:控制与远程模型的交互次数;批量执行工具调用、减少轮次;避免不必要的网络搜索与子代理(可能触发请求频率限制)。
2. **git 纪律**:每个特性、每个 bug 修复必须独立 commit(message 前缀 `feat:` / `fix:` / `docs:` / `chore:` / `refactor:`),保证开发过程可追溯、可回溯。
3. **单一跟踪文档**:任务与进度统一在 `task.md` 跟进,进度变化必须同步更新;文档描述与实现保持一致。
4. **开发顺序**:先 `docs/requirements.md` → `docs/architecture.md` → `docs/ui-design.md` → 开发计划,定稿后再编码。
5. **技术栈**:Tauri 2(Rust 壳)+ Vite + TypeScript;二维码生成 `qrcode`、识别 `jsQR`;完全离线,零网络请求,不上传任何数据。
6. **当前阶段**:需求与设计(Phase 0),设计文档定稿前不写业务代码。
