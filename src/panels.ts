// 各平台数据卡片渲染。TokenPet · 三月个人专用
import type { Snapshot, ProviderSnapshot } from "./state";
import { fmtMoney } from "./state";

export function renderPanels(el: HTMLElement, s: Snapshot): void {
  if (!s.providers.length) {
    el.innerHTML = `<div class="empty">未启用任何平台<br/>点右上角 ⚙ 配置 API Key</div>`;
    return;
  }
  el.innerHTML = s.providers.map(cardHtml).join("");
}

function cardHtml(p: ProviderSnapshot): string {
  const cls = p.status === "error" ? "card err" : "card";
  let body: string;
  if (p.status === "error") {
    body = `<div class="err-msg">⚠ ${escapeHtml(p.message || "获取失败")}</div>`;
  } else {
    const rows: string[] = [];
    rows.push(row("今日消耗", fmtMoney(p.usedToday, p.currency)));
    rows.push(row("本月消耗", fmtMoney(p.usedMonth, p.currency)));
    if (p.balance != null) rows.push(row("余额", fmtMoney(p.balance, p.currency)));
    if (p.remaining != null) rows.push(row("剩余", fmtMoney(p.remaining, p.currency)));
    body = rows.join("") + barHtml(p);
    if (p.message) body += `<div class="err-msg" style="color:var(--muted)">${escapeHtml(p.message)}</div>`;
  }
  return `<div class="${cls}">
    <div class="card-head"><span class="dot"></span>${escapeHtml(p.name)}</div>
    ${body}
  </div>`;
}

function row(label: string, value: string): string {
  return `<div class="row"><span>${label}</span><b>${value}</b></div>`;
}

function barHtml(p: ProviderSnapshot): string {
  if (p.limit == null || p.remaining == null) return "";
  const remainPct = Math.max(0, Math.min(100, (p.remaining / p.limit) * 100));
  const usedPct = 100 - remainPct;
  const color = remainPct < 20 ? "var(--danger)" : remainPct < 50 ? "var(--warn)" : "var(--ok)";
  return `<div class="bar"><div class="bar-fill" style="width:${usedPct}%;background:${color}"></div></div>
          <div class="bar-label">已用 ${usedPct.toFixed(0)}% · 剩 ${remainPct.toFixed(0)}%</div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
