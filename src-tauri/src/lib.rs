use std::io::Cursor;
use std::sync::Mutex;

use base64::Engine as _;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};

#[derive(Serialize, Clone)]
struct CaptureData {
    width: u32,
    height: u32,
    png_base64: String,
}

#[derive(Default)]
struct CaptureState(Mutex<Option<CaptureData>>);

/// 截取主显示器(位于原点的显示器;异常时退回第一个),返回 PNG 尺寸与 base64
fn capture_primary_screen() -> Result<CaptureData, String> {
    let screens = screenshots::Screen::all().map_err(|e| e.to_string())?;
    let screen = screens
        .iter()
        .find(|s| s.x == 0 && s.y == 0)
        .or_else(|| screens.first())
        .ok_or("未找到可用显示器")?;
    let image = screen.capture().map_err(|e| e.to_string())?;
    let (width, height) = (image.width(), image.height());
    let mut png = Cursor::new(Vec::new());
    image
        .write_to(&mut png, image::ImageFormat::Png)
        .map_err(|e| e.to_string())?;
    Ok(CaptureData {
        width,
        height,
        png_base64: base64::engine::general_purpose::STANDARD.encode(png.get_ref()),
    })
}

fn close_overlay(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("region-overlay") {
        let _ = window.close();
    }
}

/// 截屏 → 存状态 → 打开全屏遮罩窗口(前端进入选区模式)
#[tauri::command]
fn start_capture(app: AppHandle, state: State<'_, CaptureState>) -> Result<(), String> {
    let data = capture_primary_screen()?;
    *state.0.lock().unwrap() = Some(data);
    close_overlay(&app);
    WebviewWindowBuilder::new(&app, "region-overlay", WebviewUrl::App("index.html".into()))
        .title("屏幕选区")
        .decorations(false)
        .resizable(false)
        .fullscreen(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// 遮罩窗启动时取回截屏数据
#[tauri::command]
fn get_capture(state: State<'_, CaptureState>) -> Result<Option<CaptureData>, String> {
    Ok(state.0.lock().unwrap().clone())
}

/// 选区完成:Rust 侧只做中转(裁剪由遮罩窗 canvas 完成),关闭窗口并广播给主窗
#[tauri::command]
fn finish_capture(
    app: AppHandle,
    state: State<'_, CaptureState>,
    png_base64: String,
) -> Result<(), String> {
    *state.0.lock().unwrap() = None;
    close_overlay(&app);
    app.emit("region-captured", png_base64)
        .map_err(|e| e.to_string())
}

/// 取消选区
#[tauri::command]
fn cancel_capture(app: AppHandle, state: State<'_, CaptureState>) -> Result<(), String> {
    *state.0.lock().unwrap() = None;
    close_overlay(&app);
    Ok(())
}

// 壳只负责窗口/打包/截屏:识别与历史等业务全部在前端完成。
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(CaptureState::default())
        .invoke_handler(tauri::generate_handler![
            start_capture,
            get_capture,
            finish_capture,
            cancel_capture
        ])
        .run(tauri::generate_context!())
        .expect("QrTool 运行失败");
}
