use crate::config::ProviderConfig;
use crate::providers::model::ProviderSnapshot;
use reqwest::Client;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct BalanceInfo {
    #[serde(default)]
    currency: String,
    #[serde(default)]
    total_balance: f64,
    #[serde(default)]
    granted_balance: f64,
    #[serde(default)]
    topped_up_balance: f64,
}

#[derive(Debug, Deserialize)]
struct BalanceResp {
    #[serde(default)]
    balance_infos: Vec<BalanceInfo>,
    #[serde(default)]
    is_available: bool,
}

pub async fn fetch(client: &Client, cfg: &ProviderConfig) -> Result<ProviderSnapshot, String> {
    let key = cfg.api_key.trim();
    if key.is_empty() {
        return Err("缺少 API Key".into());
    }

    let resp: BalanceResp = client
        .get("https://api.deepseek.com/user/balance")
        .bearer_auth(key)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    // 优先展示有充值余额的币种，否则取第一个
    let info = resp
        .balance_infos
        .iter()
        .find(|i| i.topped_up_balance > 0.0)
        .or_else(|| resp.balance_infos.first());

    let (currency, balance) = match info {
        Some(i) => (i.currency.clone(), i.total_balance),
        None => (String::new(), 0.0),
    };

    Ok(ProviderSnapshot {
        name: "DeepSeek".into(),
        currency,
        used_today: 0.0,
        used_month: 0.0,
        balance: Some(balance),
        limit: None,
        remaining: Some(balance),
        status: "ok".into(),
        message: if !resp.is_available {
            Some("余额接口可能不可用，请检查账户状态".into())
        } else {
            None
        },
    })
}
