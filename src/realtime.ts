// 实时 token：读取本地代理 tools/token-proxy.mjs 的 /__stats。TokenPet · 三月个人专用
import type { ProxyConfig } from "./state";

export interface RealtimeStats {
  connected: boolean;
  upstream?: string;
  totalRequests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  last: { prompt: number; completion: number; total: number; model: string; ts: number; path?: string } | null;
  models?: Record<string, { requests: number; total: number }>;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

export function fmtTok(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return String(n);
}

export async function fetchRealtime(port: number): Promise<RealtimeStats | null> {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/__stats`, { cache: "no-store" });
    if (!r.ok) return null;
    const j = (await r.json()) as Omit<RealtimeStats, "connected">;
    return { ...j, connected: true };
  } catch {
    return null;
  }
}

// 轮询（1s）。返回停止函数。
export function startRealtime(proxy: ProxyConfig, onUpdate: (s: RealtimeStats | null) => void): () => void {
  let stopped = false;
  const tick = async () => {
    const s = await fetchRealtime(proxy.port);
    if (!stopped) onUpdate(s);
  };
  void tick();
  const timer = window.setInterval(() => void tick(), 1000);
  return () => {
    stopped = true;
    window.clearInterval(timer);
  };
}

// 头顶横幅里的实时那一行
export function realtimeBannerLine(s: RealtimeStats | null, enabled: boolean): string | null {
  if (!enabled) return null;
  if (!s) return `⚡ 实时 · 未连接本地代理（先运行 tools/token-proxy.mjs）`;
  const last = s.last;
  const head = last
    ? `⚡ 实时 · 本次 ${last.total} tok（↑${last.prompt} ↓${last.completion}）`
    : `⚡ 实时 · 等待请求…`;
  return `${head} · 累计 ${fmtTok(s.totalTokens)} tok`;
}

// 抽屉里的实时卡片
export function renderRealtime(el: HTMLElement, proxy: ProxyConfig | undefined, s: RealtimeStats | null): void {
  if (!proxy?.enabled) {
    el.innerHTML = "";
    return;
  }
  if (!s) {
    el.innerHTML = `<div class="rt-card off">
      <div class="rt-head"><span class="rt-dot"></span>实时 token · 未连接</div>
      <div class="rt-sub">先在终端运行 <code>node tools/token-proxy.mjs</code>，再把 LLM 客户端的 base_url 指到 <code>http://127.0.0.1:${proxy.port}</code></div>
    </div>`;
    return;
  }
  const last = s.last;
  const models = s.models ? Object.entries(s.models) : [];
  el.innerHTML = `<div class="rt-card">
    <div class="rt-head"><span class="rt-dot on"></span>实时 token · 已连接</div>
    <div class="rt-last">${last ? `本次 <b>${fmtTok(last.total)}</b> tok <span class="rt-dim">↑${last.prompt} ↓${last.completion}</span>` : "等待请求…"}</div>
    <div class="rt-cum">累计 <b>${fmtTok(s.totalTokens)}</b> tok · ${s.totalRequests} 次请求</div>
    ${last ? `<div class="rt-model">最近模型 ${esc(last.model)}</div>` : ""}
    ${models.length ? `<div class="rt-models">${models.map(([m, v]) => `<span>${esc(m)} · ${fmtTok(v.total)}</span>`).join("")}</div>` : ""}
  </div>`;
}
