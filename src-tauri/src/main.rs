#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod config;
mod poll;
mod providers;
mod proxy;

use std::sync::Mutex;
use tauri::Manager;

pub struct AppState {
    pub app_handle: tauri::AppHandle,
    pub config: Mutex<config::Config>,
    pub poll_interval: Mutex<u64>,
}

#[tauri::command]
fn get_config(state: tauri::State<AppState>) -> config::Config {
    state.config.lock().unwrap().clone()
}

#[tauri::command]
fn save_config(state: tauri::State<AppState>, config: config::Config) -> Result<(), String> {
    {
        let mut c = state.config.lock().unwrap();
        *c = config.clone();
    }
    config::save(&state.app_handle, &config).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_poll_interval(state: tauri::State<AppState>, secs: u64) -> Result<(), String> {
    *state.poll_interval.lock().unwrap() = secs.max(30);
    Ok(())
}

#[tauri::command]
async fn manual_refresh(
    state: tauri::State<'_, AppState>,
) -> Result<providers::model::Snapshot, String> {
    providers::fetch_all(&*state).await
}

fn main() {
    let app = tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle().clone();
            let cfg = config::load(&handle).unwrap_or_default();
            let interval = cfg.poll_interval_secs.max(30);

            // 置顶 + 简洁模式尺寸（桌面宠物：常驻所有应用前面，不占地方）
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.set_always_on_top(cfg.always_on_top.unwrap_or(true));
                let (w, h) = if cfg.compact.unwrap_or(true) {
                    (300.0, 340.0)
                } else {
                    (360.0, 600.0)
                };
                let _ = win.set_size(tauri::LogicalSize::new(w, h));
            }

            // 内置代理状态
            app.manage(proxy::ProxyState::default());

            app.manage(AppState {
                app_handle: handle.clone(),
                config: Mutex::new(cfg),
                poll_interval: Mutex::new(interval),
            });
            let app_handle = handle.clone();
            tauri::async_runtime::spawn(async move {
                poll::run(app_handle).await;
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_config,
            save_config,
            set_poll_interval,
            manual_refresh,
            proxy::proxy_start,
            proxy::proxy_stop,
            proxy::proxy_status
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            proxy::stop_child(app_handle);
        }
    });
}
