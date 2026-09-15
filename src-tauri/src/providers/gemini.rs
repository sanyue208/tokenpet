use crate::config::ProviderConfig;
use crate::providers::model::ProviderSnapshot;
use chrono::{Datelike, Utc};
use reqwest::Client;
use serde_json::Value;

pub async fn fetch(client: &Client, cfg: &ProviderConfig) -> Result<ProviderSnapshot, String> {
    let token = cfg.api_key.trim();
    if token.is_empty() {
        return Err("缺少访问令牌 (access token)".into());
    }
    let acct = cfg
        .gcp_billing_account
        .clone()
        .ok_or("缺少账单账号 billingAccount")?;
    let acct = acct.trim_start_matches("billingAccounts/");

    let now = Utc::now();
    let start = format!("{:04}-{:02}-01", now.year(), now.month());
    let end = now.format("%Y-%m-%d").to_string();

    let url = format!(
        "https://cloudbilling.googleapis.com/v1/billingAccounts/{acct}/costs?start_date={start}&end_date={end}&metric=USD"
    );

    let resp: Value = client
        .get(&url)
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    // Cloud Billing 的 costs 接口返回结构可能是：
    //   旧版： { "costs": { "USD": "123.45" } }
    //   新版： { "costs": [ { "costs": { "USD": "123.45" }, ... } ] }
    // 这里两种都兼容，累加所有 USD 数值。
    let mut used = 0.0;
    if let Some(obj) = resp.get("costs") {
        if let Some(map) = obj.as_object() {
            for (_, v) in map.iter() {
                if let Some(s) = v.as_str() {
                    if let Ok(f) = s.parse::<f64>() {
                        used += f;
                    }
                }
            }
        } else if let Some(arr) = obj.as_array() {
            for item in arr.iter() {
                if let Some(inner) = item.get("costs").and_then(|c| c.as_object()) {
                    for (_, v) in inner.iter() {
                        if let Some(s) = v.as_str() {
                            if let Ok(f) = s.parse::<f64>() {
                                used += f;
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(ProviderSnapshot {
        name: "Gemini".into(),
        currency: "USD".into(),
        used_today: 0.0,
        used_month: used,
        balance: None,
        limit: None,
        remaining: None,
        status: "ok".into(),
        message: Some("仅显示本月消耗（Cloud Billing 不提供余额/限额）".into()),
    })
}
