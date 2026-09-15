use crate::AppState;
use crate::providers;
use std::time::Duration;
use tauri::Emitter;
use tauri::Manager;

pub async fn run(app: tauri::AppHandle) {
    loop {
        let (interval, result) = {
            let st = app.state::<AppState>();
            let interval = *st.poll_interval.lock().unwrap();
            let result = providers::fetch_all(&*st).await;
            (interval, result)
        };

        match result {
            Ok(s) => {
                let _ = app.emit("snapshot", s);
            }
            Err(e) => {
                let _ = app.emit("snapshot-error", e);
            }
        }

        tokio::time::sleep(Duration::from_secs(interval.max(30))).await;
    }
}
