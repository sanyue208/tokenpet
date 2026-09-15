// 内置实时 token 代理：代理脚本在编译期被打包进 exe；
// 启用时用系统已安装的 Node 以“无窗口隐藏进程”拉起，关闭/退出时结束。
use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::Manager;

const PROXY_JS: &str = include_str!("../../tools/token-proxy.mjs");

#[derive(Default)]
pub struct ProxyState(pub Mutex<Option<Child>>);

fn find_node() -> Option<PathBuf> {
    if let Ok(out) = Command::new("where").arg("node").output() {
        if out.status.success() {
            if let Some(line) = String::from_utf8_lossy(&out.stdout).lines().next() {
                let p = PathBuf::from(line.trim());
                if p.exists() {
                    return Some(p);
                }
            }
        }
    }
    for c in [
        r"C:\Program Files\nodejs\node.exe",
        r"C:\Program Files (x86)\nodejs\node.exe",
    ] {
        let p = PathBuf::from(c);
        if p.exists() {
            return Some(p);
        }
    }
    None
}

fn script_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let js = dir.join("token-proxy.mjs");
    std::fs::write(&js, PROXY_JS).map_err(|e| e.to_string())?;
    Ok(js)
}

#[tauri::command]
pub fn proxy_start(
    app: tauri::AppHandle,
    port: u16,
    upstream: Option<String>,
) -> Result<String, String> {
    {
        let state = app.state::<ProxyState>();
        let mut guard = state.0.lock().unwrap();
        if let Some(c) = guard.as_mut() {
            if let Ok(None) = c.try_wait() {
                return Ok("already-running".into());
            }
            *guard = None;
        }
    }
    let node = find_node().ok_or_else(|| {
        "未找到 Node.js：请安装 Node LTS 后重试（或改用 tools/token-proxy.mjs 手动启动）".to_string()
    })?;
    let js = script_path(&app)?;
    let mut cmd = Command::new(node);
    cmd.arg(&js).arg("--port").arg(port.to_string());
    if let Some(u) = upstream.as_deref() {
        if !u.trim().is_empty() {
            cmd.arg("--upstream").arg(u.trim());
        }
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let child = cmd.spawn().map_err(|e| format!("启动内置代理失败：{e}"))?;
    let state = app.state::<ProxyState>();
    *state.0.lock().unwrap() = Some(child);
    Ok("started".into())
}

#[tauri::command]
pub fn proxy_stop(app: tauri::AppHandle) -> Result<(), String> {
    let state = app.state::<ProxyState>();
    let mut guard = state.0.lock().unwrap();
    if let Some(mut c) = guard.take() {
        let _ = c.kill();
        let _ = c.wait();
    }
    Ok(())
}

#[tauri::command]
pub fn proxy_status(app: tauri::AppHandle) -> bool {
    let state = app.state::<ProxyState>();
    let mut guard = state.0.lock().unwrap();
    if let Some(c) = guard.as_mut() {
        match c.try_wait() {
            Ok(None) => return true,
            _ => {
                *guard = None;
            }
        }
    }
    false
}

// 应用退出时清理子进程，避免留下孤儿进程
pub fn stop_child(app: &tauri::AppHandle) {
    if let Some(state) = app.try_state::<ProxyState>() {
        let mut guard = state.0.lock().unwrap();
        if let Some(mut c) = guard.take() {
            let _ = c.kill();
            let _ = c.wait();
        }
    }
}
