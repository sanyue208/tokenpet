use crate::config::ProviderConfig;
use crate::providers::model::ProviderSnapshot;
use chrono::{Datelike, Utc};
use reqwest::Client;
use serde::Deserialize;

#[derive(Deserialize)]
struct UsageResp {
    #[serde(default)]
    total_usage: f64, // 单位：美分
}

#[derive(Deserialize)]
struct SubResp {
    #[serde(default)]
    hard_limit_usd: Option<f64>,
    #[serde(default)]
    soft_limit_usd: Option<f64>,
    #[serde(default)]
    system_hard_limit_usd: Option<f64>,
    #[serde(default)]
    has_payment_method: Option<bool>,
}

pub async fn fetch(client: &Client, cfg: &ProviderConfig) -> Result<ProviderSnapshot, String> {
    let key = cfg.api_key.trim();
    if key.is_empty() {
        return Err("缺少 API Key".into());
    }

    let now = Utc::now();
    let today = now.format("%Y-%m-%d").to_string();
    let month_start = format!("{:04}-{:02}-01", now.year(), now.month());

    let today_url = format!(
        "https://api.openai.com/v1/dashboard/billing/usage?start_date={today}&end_date={today}"
    );
    let month_url = format!(
        "https://api.openai.com/v1/dashboard/billing/usage?start_date={month_start}&end_date={today}"
    );

    let today_usage: UsageResp = client
        .get(&today_url)
        .bearer_auth(key)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let month_usage: UsageResp = client
        .get(&month_url)
        .bearer_auth(key)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let used_today = today_usage.total_usage / 100.0;
    let used_month = month_usage.total_usage / 100.0;

    let mut limit = None;
    let mut balance = None;
    if let Ok(sub) = client
        .get("https://api.openai.com/v1/dashboard/billing/subscription")
        .bearer_auth(key)
        .send()
        .await
    {
        if let Ok(sub) = sub.json::<SubResp>().await {
            let sys = sub.system_hard_limit_usd;
            limit = sys.or(sub.hard_limit_usd).or(sub.soft_limit_usd);
            // 预付费（无支付方式）时，余额 ≈ 限额 - 本月已用
            if sub.has_payment_method == Some(false) {
                if let Some(l) = limit {
                    balance = Some((l - used_month).max(0.0));
                }
            }
        }
    }

    let remaining = match (limit, balance) {
        (Some(l), _) => Some((l - used_month).max(0.0)),
        _ => balance,
    };

    Ok(ProviderSnapshot {
        name: "OpenAI".into(),
        currency: "USD".into(),
        used_today,
        used_month,
        balance,
        limit,
        remaining,
        status: "ok".into(),
        message: None,
    })
}
