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

/// 单个显示器的截屏与其逻辑坐标(物理坐标 / 缩放比),用于遮罩窗口跨屏定位
#[derive(Clone)]
struct ScreenCapture {
    data: CaptureData,
    x: f64,
    y: f64,
    w: f64,
    h: f64,
}

#[derive(Default)]
struct CaptureState(Mutex<Vec<ScreenCapture>>);

fn capture_screen(screen: &screenshots::Screen) -> Result<CaptureData, String> {
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

/// 逐屏截屏;坐标换算为逻辑值(物理 / 缩放),供遮罩窗口跨屏定位
fn capture_all_screens() -> Result<Vec<ScreenCapture>, String> {
    let screens = screenshots::Screen::all().map_err(|e| e.to_string())?;
    if screens.is_empty() {
        return Err("未找到可用显示器".into());
    }
    let mut out = Vec::with_capacity(screens.len());
    for screen in &screens {
        let data = capture_screen(screen)?;
        let scale = f64::from(screen.display_info.scale_factor).max(1.0);
        out.push(ScreenCapture {
            data,
            x: f64::from(screen.display_info.x) / scale,
            y: f64::from(screen.display_info.y) / scale,
            w: f64::from(screen.display_info.width) / scale,
            h: f64::from(screen.display_info.height) / scale,
        });
    }
    Ok(out)
}

fn close_all_overlays(app: &AppHandle) {
    for (label, window) in app.webview_windows() {
        if label.starts_with("region-overlay") {
            let _ = window.close();
        }
    }
}

/// 逐屏截屏 → 存状态 → 每个显示器开一个遮罩窗口(均可独立框选)。
/// 必须为 async:Windows 上在同步命令内创建窗口会死锁(命令阻塞主线程,
/// 而窗口创建又依赖主线程事件循环),参考 Tauri 官方文档的 async command 指引。
#[tauri::command]
async fn start_capture(app: AppHandle, state: State<'_, CaptureState>) -> Result<(), String> {
    let captures = capture_all_screens()?;
    let count = captures.len();
    *state.0.lock().unwrap() = captures;
    close_all_overlays(&app);
    for i in 0..count {
        let screen = {
            let guard = state.0.lock().unwrap();
            guard[i].clone()
        };
        WebviewWindowBuilder::new(
            &app,
            format!("region-overlay-{i}"),
            WebviewUrl::App("index.html".into()),
        )
        .title(format!("屏幕选区 {}", i + 1))
        .decorations(false)
        .resizable(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .background_color(tauri::window::Color(0, 0, 0, 255))
        .position(screen.x, screen.y)
        .inner_size(screen.w, screen.h)
        .build()
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 遮罩窗启动时取回自己那一屏的截屏数据(按窗口序号)
#[tauri::command]
async fn get_capture(
    state: State<'_, CaptureState>,
    index: usize,
) -> Result<Option<CaptureData>, String> {
    Ok(state.0.lock().unwrap().get(index).map(|s| s.data.clone()))
}

/// 选区完成:Rust 侧只做中转(裁剪由遮罩窗 canvas 完成),关闭全部遮罩并广播给主窗
#[tauri::command]
async fn finish_capture(
    app: AppHandle,
    state: State<'_, CaptureState>,
    png_base64: String,
) -> Result<(), String> {
    *state.0.lock().unwrap() = Vec::new();
    close_all_overlays(&app);
    app.emit("region-captured", png_base64)
        .map_err(|e| e.to_string())
}

/// 取消选区:关闭全部遮罩
#[tauri::command]
async fn cancel_capture(app: AppHandle, state: State<'_, CaptureState>) -> Result<(), String> {
    *state.0.lock().unwrap() = Vec::new();
    close_all_overlays(&app);
    Ok(())
}

// 壳负责窗口/打包/截屏:识别与生成等业务全部在前端完成。
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
