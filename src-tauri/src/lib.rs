use std::io::{Cursor, Write as _};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant};

use base64::Engine as _;
use chrono::Local as LocalTime;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};

static LOG_FILE: OnceLock<Option<PathBuf>> = OnceLock::new();

fn ensure_writable_dir(dir: &PathBuf) -> bool {
    if std::fs::create_dir_all(dir).is_err() {
        return false;
    }
    // 目录存在不代表可写(如 Program Files),做一次真实写探针
    let probe = dir.join(".write-probe");
    match std::fs::File::create(&probe) {
        Ok(_) => {
            let _ = std::fs::remove_file(&probe);
            true
        }
        Err(_) => false,
    }
}

/// 日志文件解析规则(用户约束):优先 exe 同级 logs\(绿色版 / debug 版);
/// 不可写(安装版位于 Program Files)时回退应用数据目录。结果进程内缓存。
fn log_file_path(app: &AppHandle) -> Option<PathBuf> {
    LOG_FILE
        .get_or_init(|| {
            let date = LocalTime::now().format("%Y%m%d");
            if let Ok(exe) = std::env::current_exe() {
                if let Some(dir) = exe.parent() {
                    let candidate = dir.join("logs");
                    if ensure_writable_dir(&candidate) {
                        return Some(candidate.join(format!("qr-tool-{date}.log")));
                    }
                }
            }
            let fallback = app.path().app_local_data_dir().ok()?.join("logs");
            std::fs::create_dir_all(&fallback).ok()?;
            Some(fallback.join(format!("qr-tool-{date}.log")))
        })
        .clone()
}

/// 追加一行到当天日志文件(FR-10:人类可读,毫秒精度)
fn write_line(app: &AppHandle, line: &str) {
    println!("{line}");
    if let Some(path) = log_file_path(app) {
        if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open(path) {
            let _ = writeln!(file, "{line}");
        }
    }
}

fn log_event(app: &AppHandle, scope: &str, message: &str) {
    let ts = LocalTime::now().format("%Y-%m-%d %H:%M:%S%.3f");
    write_line(app, &format!("[{ts}][{scope}] {message}"));
}

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

/// 逐屏截屏;坐标换算为逻辑值(物理 / 缩放),供遮罩窗口跨屏定位。
/// 多屏并行截屏以压缩总耗时。
fn capture_all_screens() -> Result<Vec<ScreenCapture>, String> {
    let screens = screenshots::Screen::all().map_err(|e| e.to_string())?;
    if screens.is_empty() {
        return Err("未找到可用显示器".into());
    }
    let results: Vec<Result<ScreenCapture, String>> = std::thread::scope(|scope| {
        let handles: Vec<_> = screens
            .iter()
            .map(|screen| {
                scope.spawn(move || {
                    let data = capture_screen(screen)?;
                    let scale = f64::from(screen.display_info.scale_factor).max(1.0);
                    Ok(ScreenCapture {
                        data,
                        x: f64::from(screen.display_info.x) / scale,
                        y: f64::from(screen.display_info.y) / scale,
                        w: f64::from(screen.display_info.width) / scale,
                        h: f64::from(screen.display_info.height) / scale,
                    })
                })
            })
            .collect();
        handles
            .into_iter()
            .map(|h| h.join().map_err(|e| format!("截屏线程崩溃:{e:?}")).and_then(|r| r))
            .collect()
    });
    results.into_iter().collect()
}

fn close_all_overlays(app: &AppHandle) {
    for (label, window) in app.webview_windows() {
        if label.starts_with("region-overlay") {
            let _ = window.close();
            log_event(app, "capture", &format!("遮罩窗 {label} 已关闭"));
        }
    }
}

fn set_main_window_visible(app: &AppHandle, visible: bool) {
    if let Some(window) = app.get_webview_window("main") {
        let result = if visible { window.show() } else { window.hide() };
        if let Err(e) = result {
            log_event(app, "capture", &format!("主窗显隐失败:{e}"));
        } else {
            log_event(app, "capture", &format!("主窗{}", if visible { "已恢复显示" } else { "已隐藏(避免污染选区画面)" }));
        }
    }
}

/// 逐屏截屏 → 存状态 → 每个显示器开一个遮罩窗口(均可独立框选)。
/// 必须为 async:Windows 上在同步命令内创建窗口会死锁(命令阻塞主线程,
/// 而窗口创建又依赖主线程事件循环),参考 Tauri 官方文档的 async command 指引。
#[tauri::command]
async fn start_capture(app: AppHandle, state: State<'_, CaptureState>) -> Result<(), String> {
    let t0 = Instant::now();
    log_event(&app, "capture", "开始屏幕截取");
    // 先隐藏主窗:它不属于可选内容,且避免紫色 UI 出现在选区画面里
    set_main_window_visible(&app, false);
    // hide 是异步派发的:用主线程有序回调确认 hide 已被事件循环处理(等待 ≤500ms),
    // 否则截屏会带上主窗"幽灵副本"(is_visible 轮询不可靠,tao 返回内部标志)
    let hidden = Arc::new(AtomicBool::new(false));
    let hidden_flag = hidden.clone();
    app.run_on_main_thread(move || hidden_flag.store(true, Ordering::SeqCst))
        .map_err(|e| e.to_string())?;
    let wait_start = Instant::now();
    while !hidden.load(Ordering::SeqCst) {
        if wait_start.elapsed() > Duration::from_millis(500) {
            log_event(&app, "capture", "主窗隐藏确认超时(继续截屏)");
            break;
        }
        std::thread::sleep(std::time::Duration::from_millis(10));
    }
    log_event(&app, "capture", &format!("主窗隐藏确认,累计 {}ms", t0.elapsed().as_millis()));
    let captures = capture_all_screens()?;
    let count = captures.len();
    for (i, sc) in captures.iter().enumerate() {
        log_event(
            &app,
            "capture",
            &format!(
                "屏幕 {i}: {}x{} px, 逻辑位置 ({:.0},{:.0}) 尺寸 {:.0}x{:.0}",
                sc.data.width, sc.data.height, sc.x, sc.y, sc.w, sc.h
            ),
        );
    }
    *state.0.lock().unwrap() = captures;
    close_all_overlays(&app);
    for i in 0..count {
        let screen = {
            let guard = state.0.lock().unwrap();
            guard[i].clone()
        };
        let label = format!("region-overlay-{i}");
        WebviewWindowBuilder::new(
            &app,
            label.clone(),
            WebviewUrl::App("index.html".into()),
        )
        .title(format!("屏幕选区 {}", i + 1))
        .decorations(false)
        .resizable(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible(false)
        .background_color(tauri::window::Color(0, 0, 0, 255))
        .position(screen.x, screen.y)
        .inner_size(screen.w, screen.h)
        .build()
        .map_err(|e| {
            log_event(&app, "capture", &format!("遮罩窗 {label} 创建失败:{e}"));
            e.to_string()
        })?;
        log_event(
            &app,
            "capture",
            &format!(
                "遮罩窗 {label} 已创建(隐藏,避免开窗展开动画),({:.0},{:.0}) {:.0}x{:.0},累计 {}ms",
                screen.x,
                screen.y,
                screen.w,
                screen.h,
                t0.elapsed().as_millis()
            ),
        );
    }
    log_event(
        &app,
        "capture",
        &format!(
            "全部遮罩创建完成(隐藏),共 {count} 屏,总耗时 {}ms;待前端就绪后显示",
            t0.elapsed().as_millis()
        ),
    );
    Ok(())
}

/// 遮罩窗内容与位图就绪后由前端调用:显示窗口。隐藏创建 + 就绪后显示,
/// 可避免 Windows 对"创建即可见"窗口的开窗展开动画(用户反馈的紫色一闪)。
#[tauri::command]
async fn show_overlay(app: AppHandle, index: usize) -> Result<(), String> {
    let label = format!("region-overlay-{index}");
    match app.get_webview_window(&label) {
    Some(window) => {
        window.show().map_err(|e| e.to_string())?;
        let _ = window.set_always_on_top(true);
        log_event(&app, "capture", &format!("遮罩窗 {label} 已显示(淡入)"));
        Ok(())
    }
        None => {
            log_event(&app, "capture", &format!("show_overlay:{label} 不存在"));
            Err(format!("{label} 不存在"))
        }
    }
}

/// 遮罩窗启动时取回自己那一屏的截屏数据(按窗口序号)
#[tauri::command]
async fn get_capture(
    app: AppHandle,
    state: State<'_, CaptureState>,
    index: usize,
) -> Result<Option<CaptureData>, String> {
    let capture = state.0.lock().unwrap().get(index).map(|s| s.data.clone());
    match &capture {
        Some(data) => log_event(
            &app,
            "capture",
            &format!("遮罩窗 {index} 取图:{}x{},base64 {} 字符", data.width, data.height, data.png_base64.len()),
        ),
        None => log_event(&app, "capture", &format!("遮罩窗 {index} 取图失败:状态为空(可能非应用内发起)")),
    }
    Ok(capture)
}

/// 选区完成:Rust 侧只做中转(裁剪由遮罩窗 canvas 完成),关闭全部遮罩并广播给主窗
#[tauri::command]
async fn finish_capture(
    app: AppHandle,
    state: State<'_, CaptureState>,
    png_base64: String,
) -> Result<(), String> {
    log_event(&app, "capture", &format!("选区完成,回传 PNG base64 {} 字符", png_base64.len()));
    *state.0.lock().unwrap() = Vec::new();
    close_all_overlays(&app);
    set_main_window_visible(&app, true);
    app.emit("region-captured", png_base64)
        .map_err(|e| e.to_string())
}

/// 取消选区:关闭全部遮罩
#[tauri::command]
async fn cancel_capture(app: AppHandle, state: State<'_, CaptureState>) -> Result<(), String> {
    log_event(&app, "capture", "选区取消");
    *state.0.lock().unwrap() = Vec::new();
    close_all_overlays(&app);
    set_main_window_visible(&app, true);
    Ok(())
}

/// 识别失败的选区样张落盘(仅本地日志目录,用于定位裁剪内容问题)
#[tauri::command]
async fn dump_failed_region(app: AppHandle, png_base64: String) -> Result<String, String> {
    let dir = log_file_path(&app)
        .and_then(|p| p.parent().map(|d| d.to_path_buf()))
        .unwrap_or_else(|| PathBuf::from("."));
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(format!("failed-region-{}.png", LocalTime::now().format("%H%M%S%.3f")));
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&png_base64)
        .map_err(|e| e.to_string())?;
    std::fs::write(&path, bytes).map_err(|e| e.to_string())?;
    log_event(&app, "capture", &format!("识别失败的选区样张已保存:{}", path.display()));
    Ok(path.display().to_string())
}

/// 前端日志批量落盘(FR-10)
#[tauri::command]
async fn append_log(app: AppHandle, lines: Vec<String>) -> Result<(), String> {
    for line in &lines {
        write_line(&app, line);
    }
    Ok(())
}

// 壳负责窗口/打包/截屏:识别与生成等业务全部在前端完成。
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(CaptureState::default())
        .setup(|app| {
            let handle = app.handle().clone();
            log_event(&handle, "app", &format!(
                "应用启动 v{},日志文件:{}",
                app.package_info().version,
                log_file_path(&handle)
                    .map(|p| p.display().to_string())
                    .unwrap_or_else(|| "不可用".into())
            ));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            start_capture,
            get_capture,
            finish_capture,
            cancel_capture,
            append_log,
            show_overlay,
            dump_failed_region
        ])
        .run(tauri::generate_context!())
        .expect("QrTool 运行失败");
}
