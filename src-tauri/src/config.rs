use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::AppHandle;

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConfig {
    pub name: String,
    pub enabled: bool,
    pub api_key: String,
    pub endpoint: Option<String>,
    pub mapping: Option<serde_json::Value>,
    pub gcp_project: Option<String>,
    pub gcp_billing_account: Option<String>,
}

impl Default for ProviderConfig {
    fn default() -> Self {
        ProviderConfig {
            name: String::new(),
            enabled: false,
            api_key: String::new(),
            endpoint: None,
            mapping: None,
            gcp_project: None,
            gcp_billing_account: None,
        }
    }
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyConfig {
    pub enabled: bool,
    pub port: u16,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    pub poll_interval_secs: u64,
    pub openai: ProviderConfig,
    pub deepseek: ProviderConfig,
    pub gemini: ProviderConfig,
    pub custom_providers: Vec<ProviderConfig>,
    pub pet_image: Option<String>,
    pub pet_style: Option<String>,
    pub pet_preset: Option<String>,
    pub compact: Option<bool>,
    pub always_on_top: Option<bool>,
    pub bg_alpha: Option<f64>,
    pub proxy: Option<ProxyConfig>,
}

impl Default for Config {
    fn default() -> Self {
        Config {
            poll_interval_secs: 300,
            openai: ProviderConfig {
                name: "OpenAI".into(),
                enabled: true,
                ..Default::default()
            },
            deepseek: ProviderConfig {
                name: "DeepSeek".into(),
                enabled: true,
                ..Default::default()
            },
            gemini: ProviderConfig {
                name: "Gemini".into(),
                ..Default::default()
            },
            custom_providers: Vec::new(),
            pet_image: None,
            pet_style: Some("cat".into()),
            pet_preset: Some("clawd-happy".into()),
            compact: Some(true),
            always_on_top: Some(true),
            bg_alpha: Some(1.0),
            proxy: Some(ProxyConfig {
                enabled: false,
                port: 8787,
            }),
        }
    }
}

pub fn config_path(app: &AppHandle) -> Option<PathBuf> {
    let dir = app.path().app_config_dir().ok()?;
    let _ = std::fs::create_dir_all(&dir);
    Some(dir.join("config.json"))
}

pub fn load(app: &AppHandle) -> Option<Config> {
    let path = config_path(app)?;
    let data = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&data).ok()
}

pub fn save(app: &AppHandle, cfg: &Config) -> Result<(), Box<dyn std::error::Error>> {
    let path = config_path(app).ok_or("no config dir")?;
    let data = serde_json::to_string_pretty(cfg)?;
    std::fs::write(path, data)?;
    Ok(())
}
