use serde::Serialize;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderSnapshot {
    pub name: String,
    pub currency: String,
    pub used_today: f64,
    pub used_month: f64,
    pub balance: Option<f64>,
    pub limit: Option<f64>,
    pub remaining: Option<f64>,
    pub status: String,
    pub message: Option<String>,
}

impl ProviderSnapshot {
    pub fn error(name: &str, msg: &str) -> Self {
        ProviderSnapshot {
            name: name.to_string(),
            currency: String::new(),
            used_today: 0.0,
            used_month: 0.0,
            balance: None,
            limit: None,
            remaining: None,
            status: "error".to_string(),
            message: Some(msg.to_string()),
        }
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub updated_at: String,
    pub providers: Vec<ProviderSnapshot>,
}
