pub mod custom;
pub mod deepseek;
pub mod gemini;
pub mod model;
pub mod openai;

use crate::config::Config;
use crate::AppState;
use model::{ProviderSnapshot, Snapshot};
use reqwest::Client;

pub async fn fetch_all(state: &AppState) -> Result<Snapshot, String> {
    let cfg: Config = state.config.lock().unwrap().clone();

    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())?;

    let mut providers: Vec<ProviderSnapshot> = Vec::new();

    if cfg.openai.enabled {
        providers.push(match openai::fetch(&client, &cfg.openai).await {
            Ok(s) => s,
            Err(e) => ProviderSnapshot::error("OpenAI", &e),
        });
    }
    if cfg.deepseek.enabled {
        providers.push(match deepseek::fetch(&client, &cfg.deepseek).await {
            Ok(s) => s,
            Err(e) => ProviderSnapshot::error("DeepSeek", &e),
        });
    }
    if cfg.gemini.enabled {
        providers.push(match gemini::fetch(&client, &cfg.gemini).await {
            Ok(s) => s,
            Err(e) => ProviderSnapshot::error("Gemini", &e),
        });
    }
    // 任意数量的自定义 / 国内厂商
    for p in &cfg.custom_providers {
        if !p.enabled {
            continue;
        }
        let name = if p.name.trim().is_empty() {
            "自定义"
        } else {
            p.name.trim()
        };
        providers.push(match custom::fetch(&client, p, name).await {
            Ok(s) => s,
            Err(e) => ProviderSnapshot::error(name, &e),
        });
    }

    Ok(Snapshot {
        updated_at: chrono::Utc::now().to_rfc3339(),
        providers,
    })
}
