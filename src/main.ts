// 入口：组装 UI、连接后端 / mock、处理交互。TokenPet · 三月个人专用
import { getConfig, saveConfig, listenSnapshot, manualRefresh, windowControls, isTauri } from "./tauri-api";
import type { WindowControls } from "./tauri-api";
import type { Config, Snapshot, ProviderSnapshot, PetStyle } from "./state";
import { fmtMoney, applyBgAlpha } from "./state";
import { renderPet, setMood } from "./pet";
import { renderPanels } from "./panels";
import { setupBanner, setBannerMessages } from "./banner";
import { openSettings } from "./settings";
import { startRealtime, renderRealtime, realtimeBannerLine, type RealtimeStats } from "./realtime";

let config: Config | null = null;
let win: WindowControls | null = null;
let realtime: RealtimeStats | null = null;
let stopRealtime: (() => void) | null = null;

// 窗口尺寸：收起=小巧不挡事；展开=容纳详情卡片
const SIZE_COMPACT = { w: 300, h: 340 };
const SIZE_FULL = { w: 360, h: 600 };

function rerenderPet(): void {
  const el = document.getElementById("pet");
  if (el)
    renderPet(el, {
      image: config?.petImage ?? null,
      preset: config?.petPreset ?? null,
      style: (config?.petStyle as PetStyle) || "cat",
    });
}

function buildBannerMessages(s: Snapshot): string[] {
  return s.providers.map((p: ProviderSnapshot) => {
    if (p.status === "error") return `${p.name}：获取失败`;
    const parts: string[] = [];
    if (p.usedToday > 0) parts.push(`今日 ${fmtMoney(p.usedToday, p.currency)}`);
    if (p.usedMonth > 0) parts.push(`本月 ${fmtMoney(p.usedMonth, p.currency)}`);
    if (p.balance != null) parts.push(`余额 ${fmtMoney(p.balance, p.currency)}`);
    if (p.remaining != null) parts.push(`剩余 ${fmtMoney(p.remaining, p.currency)}`);
    const tail = parts.length ? parts.join(" · ") : "暂无消耗数据";
    return `${p.name} ${tail}`;
  });
}

// 展开 / 收起底部详情抽屉；收起时窗口同步缩小，尽量不遮挡其它窗口
function setExpanded(expanded: boolean, persist = true): void {
  const app = document.getElementById("app");
  if (!app) return;
  app.classList.toggle("compact", !expanded);
  const chev = document.querySelector("#btn-toggle .chev");
  if (chev) chev.textContent = expanded ? "⌄" : "⌃";
  const size = expanded ? SIZE_FULL : SIZE_COMPACT;
  win?.setSize(size.w, size.h);
  if (persist && config) {
    config.compact = !expanded;
    void saveConfig(config);
  }
}

function updateRealtimeUI(): void {
  const enabled = config?.proxy?.enabled ?? false;
  const line = document.getElementById("rtLine");
  const text = realtimeBannerLine(realtime, enabled);
  if (line) {
    if (text) {
      line.textContent = text;
      line.hidden = false;
    } else {
      line.hidden = true;
      line.textContent = "";
    }
  }
  const rt = document.getElementById("realtime");
  if (rt) renderRealtime(rt, config?.proxy, realtime);
}

// 按配置启停实时轮询（1s 拉一次本地代理 /__stats）
function restartRealtime(): void {
  stopRealtime?.();
  stopRealtime = null;
  realtime = null;
  if (config?.proxy?.enabled) {
    stopRealtime = startRealtime(config.proxy, (s) => {
      realtime = s;
      updateRealtimeUI();
    });
  }
  updateRealtimeUI();
}

async function main(): Promise<void> {
  const app = document.getElementById("app");
  if (!app) return;

  app.innerHTML = `
    <div class="titlebar" id="titlebar">
      <span class="brand">🐾</span>
      <span class="spacer"></span>
      <button class="icon-btn" id="btn-settings" title="设置">⚙</button>
      <button class="icon-btn" id="btn-refresh" title="立即刷新">⟳</button>
      <button class="icon-btn" id="btn-min" title="最小化">—</button>
      <button class="icon-btn" id="btn-close" title="关闭">✕</button>
    </div>
    <div class="banner-wrap">
      <div class="rt-line" id="rtLine" hidden></div>
      <div id="banner"></div>
    </div>
    <div class="pet-area" id="pet"></div>
    <button class="drawer-handle" id="btn-toggle" title="展开 / 收起详情">
      <span class="chev">⌃</span><span class="drawer-hint">消耗详情</span>
    </button>
    <div class="drawer" id="drawer">
      <div id="realtime"></div>
      <div class="panels" id="panels"></div>
      <div class="footer"><span id="updated">加载中…</span></div>
    </div>
  `;

  setupBanner(document.getElementById("banner") as HTMLElement);
  rerenderPet();

  win = await windowControls();
  document.getElementById("titlebar")?.addEventListener("mousedown", (e) => {
    if ((e.target as HTMLElement).tagName === "BUTTON") return;
    win?.drag();
  });

  const openCfg = async () => {
    if (!config) config = await getConfig();
    if (!config.customProviders) config.customProviders = [];
    openSettings(
      config,
      async (cfg) => {
        config = cfg;
        await saveConfig(cfg);
        win?.setAlwaysOnTop(cfg.alwaysOnTop ?? true);
        applyBgAlpha(cfg.bgAlpha ?? 1);
        rerenderPet();
        restartRealtime();
      },
      rerenderPet
    );
  };

  document.getElementById("btn-settings")?.addEventListener("click", openCfg);
  document.getElementById("pet")?.addEventListener("click", openCfg);
  document.getElementById("btn-toggle")?.addEventListener("click", () => {
    const isCompact = document.getElementById("app")?.classList.contains("compact") ?? true;
    setExpanded(isCompact);
  });
  document.getElementById("btn-refresh")?.addEventListener("click", async () => {
    const s = await manualRefresh();
    applySnapshot(s);
  });
  document.getElementById("btn-min")?.addEventListener("click", () => win?.minimize());
  document.getElementById("btn-close")?.addEventListener("click", () => win?.close());

  config = await getConfig();
  if (!config.customProviders) config.customProviders = [];
  if (!config.petStyle) config.petStyle = "cat";
  rerenderPet();

  win.setAlwaysOnTop(config.alwaysOnTop ?? true);
  applyBgAlpha(config.bgAlpha ?? 1);
  setExpanded(!(config.compact ?? true), false); // 初始化按保存状态布局，不写盘
  restartRealtime();

  await listenSnapshot(applySnapshot);
  const first = await manualRefresh();
  applySnapshot(first);
}

function applySnapshot(s: Snapshot): void {
  renderPanels(document.getElementById("panels") as HTMLElement, s);
  setBannerMessages(buildBannerMessages(s));
  const d = new Date(s.updatedAt);
  const t = d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const tag = isTauri ? "" : " · 预览模式";
  const el = document.getElementById("updated");
  if (el) el.textContent = `更新于 ${t}${tag}`;

  const worried = s.providers.some(
    (p) => p.limit != null && p.remaining != null && p.limit > 0 && p.remaining / p.limit < 0.2
  );
  setMood(worried ? "worried" : s.providers.length ? "happy" : "neutral");
}

void main();
