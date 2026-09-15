// 与 Tauri 后端通信的封装；在普通浏览器中自动降级为 mock 数据，方便预览。
import type { Config, Snapshot } from "./state";
import { defaultConfig } from "./state";

export const isTauri = "__TAURI_INTERNALS__" in window;

export async function getConfig(): Promise<Config> {
  if (!isTauri) {
    const saved = localStorage.getItem("tp_config");
    if (saved) {
      try {
        return JSON.parse(saved) as Config;
      } catch {
        /* ignore */
      }
    }
    return defaultConfig();
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return (await invoke("get_config")) as Config;
}

export async function saveConfig(cfg: Config): Promise<void> {
  if (!isTauri) {
    localStorage.setItem("tp_config", JSON.stringify(cfg));
    return;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("save_config", { config: cfg });
}

export async function setPollInterval(secs: number): Promise<void> {
  if (!isTauri) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("set_poll_interval", { secs });
}

export async function manualRefresh(): Promise<Snapshot> {
  if (!isTauri) return mockSnapshot();
  const { invoke } = await import("@tauri-apps/api/core");
  return (await invoke("manual_refresh")) as Snapshot;
}

// 内置实时 token 代理（app 内部启动，无需另开窗口）
export async function proxyStart(port: number, upstream?: string): Promise<void> {
  if (!isTauri) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("proxy_start", { port, upstream: upstream ?? null });
}

export async function proxyStop(): Promise<void> {
  if (!isTauri) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("proxy_stop");
}

export async function proxyRunning(): Promise<boolean> {
  if (!isTauri) return false;
  const { invoke } = await import("@tauri-apps/api/core");
  return (await invoke("proxy_status")) as boolean;
}

export async function listenSnapshot(cb: (s: Snapshot) => void): Promise<void> {
  if (!isTauri) {
    mockLoop(cb);
    return;
  }
  const { listen } = await import("@tauri-apps/api/event");
  await listen<Snapshot>("snapshot", (e) => cb(e.payload));
}

export interface WindowControls {
  drag(): void;
  minimize(): void;
  close(): void;
  setAlwaysOnTop(v: boolean): void;
  setSize(width: number, height: number): void;
}

export async function windowControls(): Promise<WindowControls> {
  if (!isTauri) {
    return { drag() {}, minimize() {}, close() {}, setAlwaysOnTop() {}, setSize() {} };
  }
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const { LogicalSize } = await import("@tauri-apps/api/dpi");
  const w = getCurrentWindow();
  return {
    drag: () => {
      void w.startDragging();
    },
    minimize: () => void w.minimize(),
    close: () => void w.close(),
    setAlwaysOnTop: (v: boolean) => void w.setAlwaysOnTop(v),
    setSize: (width: number, height: number) => void w.setSize(new LogicalSize(width, height)),
  };
}

// ---------------- 浏览器预览用的 mock 数据 ----------------
let mock = { oaiMonth: 42.5, dsBal: 9.83 };

function mockSnapshot(): Snapshot {
  mock.oaiMonth += Math.random() * 0.4;
  mock.dsBal = Math.max(0.4, mock.dsBal - Math.random() * 0.04);
  const now = new Date().toISOString();
  return {
    updatedAt: now,
    providers: [
      {
        name: "OpenAI",
        currency: "USD",
        usedToday: 3.21 + Math.random() * 0.5,
        usedMonth: mock.oaiMonth,
        balance: null,
        limit: 120,
        remaining: 120 - mock.oaiMonth,
        status: "ok",
        message: null,
      },
      {
        name: "DeepSeek",
        currency: "CNY",
        usedToday: 0,
        usedMonth: 0,
        balance: mock.dsBal,
        limit: null,
        remaining: mock.dsBal,
        status: "ok",
        message: null,
      },
      {
        name: "Gemini",
        currency: "USD",
        usedToday: 0,
        usedMonth: 1.07 + Math.random() * 0.1,
        balance: null,
        limit: null,
        remaining: null,
        status: "ok",
        message: "仅显示本月消耗（Cloud Billing 不提供余额/限额）",
      },
    ],
  };
}

function mockLoop(cb: (s: Snapshot) => void): void {
  cb(mockSnapshot());
  window.setInterval(() => cb(mockSnapshot()), 6000);
}
