fn main() {
    // 构建时间标记:注入到二进制,用于运行时验证"当前运行的是哪次构建"
    let unix = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    println!("cargo:rustc-env=BUILD_UNIX={unix}");
    tauri_build::build()
}
