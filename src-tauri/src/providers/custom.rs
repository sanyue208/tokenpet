use crate::config::ProviderConfig;
use crate::providers::model::ProviderSnapshot;
use reqwest::Client;
use serde_json::Value;

pub async fn fetch(
    client: &Client,
    cfg: &ProviderConfig,
    name: &str,
) -> Result<ProviderSnapshot, String> {
    let endpoint = cfg.endpoint.clone().ok_or("缺少用量接口 URL")?;
    let key = cfg.api_key.trim();

    let mut req = client.get(&endpoint);
    if !key.is_empty() {
        req = req.bearer_auth(key);
    }
    let resp: Value = req
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let mapping = cfg.mapping.clone().unwrap_or(Value::Null);

    let resolve_num = |field: &str| -> Option<f64> {
        let path = mapping.get(field).and_then(|v| v.as_str())?;
        match jsonpath(&resp, path)? {
            Value::Number(n) => n.as_f64(),
            Value::String(s) => s.trim().parse::<f64>().ok(),
            _ => None,
        }
    };

    let currency = mapping
        .get("currency")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| "USD".into());

    let used_today = resolve_num("usedToday").unwrap_or(0.0);
    let used_month = resolve_num("usedMonth").unwrap_or(0.0);
    let balance = resolve_num("balance");
    let limit = resolve_num("limit");
    let remaining = resolve_num("remaining").or_else(|| match (limit, used_month) {
        (Some(l), u) => Some((l - u).max(0.0)),
        _ => None,
    });

    Ok(ProviderSnapshot {
        name: name.to_string(),
        currency,
        used_today,
        used_month,
        balance,
        limit,
        remaining,
        status: "ok".into(),
        message: None,
    })
}

// 极简 JSONPath：支持 $.a.b.c 与 $.a[0].b
pub fn jsonpath<'a>(root: &'a Value, path: &'a str) -> Option<&'a Value> {
    if !path.starts_with('$') {
        return None;
    }
    let mut cur = root;
    for part in path[1..].split('.').filter(|s| !s.is_empty()) {
        if part.starts_with('[') && part.ends_with(']') {
            let idx: usize = part[1..part.len() - 1].parse().ok()?;
            cur = cur.get(idx)?;
        } else {
            cur = cur.get(part)?;
        }
    }
    Some(cur)
}
