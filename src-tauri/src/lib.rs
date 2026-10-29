// v1 无 Rust 业务逻辑:识别/历史/UI 全部在前端完成,壳只负责窗口与打包。
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("QrTool 运行失败");
}
