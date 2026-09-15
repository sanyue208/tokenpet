// 共享类型与格式化工具 —— TokenPet · 三月个人专用

export interface ProviderSnapshot {
  name: string;
  currency: string;
  usedToday: number;
  usedMonth: number;
  balance: number | null;
  limit: number | null;
  remaining: number | null;
  status: "ok" | "error" | "loading";
  message?: string | null;
}

export interface Snapshot {
  updatedAt: string;
  providers: ProviderSnapshot[];
}

export interface ProviderConfig {
  name: string; // 展示名（自定义厂商必填；内置厂商忽略）
  enabled: boolean;
  apiKey: string;
  endpoint?: string | null;
  mapping?: Record<string, string> | null;
  gcpProject?: string | null;
  gcpBillingAccount?: string | null;
}

export type PetStyle = "cat" | "ghost" | "robot";

export interface PetPreset {
  key: string; // 对应 public/pets/{key}.svg
  label: string;
  emoji: string;
}

// 来源于 GitHub 仓库 abderrahimghazali/clawd-pet（MIT），已下载到 public/pets/
export const PET_PRESETS: PetPreset[] = [
  { key: "clawd-happy", label: "开心", emoji: "😊" },
  { key: "clawd-smile", label: "微笑", emoji: "🙂" },
  { key: "clawd-laughing", label: "大笑", emoji: "😆" },
  { key: "clawd-love", label: "爱心", emoji: "😍" },
  { key: "clawd-cool", label: "酷", emoji: "😎" },
  { key: "clawd-dancing", label: "跳舞", emoji: "💃" },
  { key: "clawd-gaming", label: "游戏", emoji: "🎮" },
  { key: "clawd-coding", label: "代码", emoji: "💻" },
  { key: "clawd-music", label: "音乐", emoji: "🎵" },
  { key: "clawd-star", label: "星星", emoji: "⭐" },
  { key: "clawd-rainbow", label: "彩虹", emoji: "🌈" },
  { key: "clawd-waving", label: "招手", emoji: "👋" },
  { key: "clawd-sleeping", label: "睡觉", emoji: "😴" },
  { key: "clawd-astronaut", label: "宇航员", emoji: "🚀" },
  { key: "clawd-magic", label: "魔法", emoji: "🪄" },
  { key: "clawd-celebrating", label: "庆祝", emoji: "🎉" },
];

export interface ProxyConfig {
  enabled: boolean; // 是否启用实时 token（本地代理）
  port: number; // 本地代理端口，默认 8787
}

export interface Config {
  pollIntervalSecs: number;
  openai: ProviderConfig;
  deepseek: ProviderConfig;
  gemini: ProviderConfig;
  customProviders: ProviderConfig[]; // 任意数量的自定义/国内厂商
  petStyle?: PetStyle; // 内置宠物样式（cat / ghost / robot）
  petImage?: string | null; // 上传的宠物图片（data URL），优先级最高
  petPreset?: string | null; // GitHub clawd-pet 预设（public/pets/{key}.svg），优先级高于 petStyle
  compact?: boolean; // 简洁模式：只留宠物+横幅，详情抽屉收起（默认 true）
  alwaysOnTop?: boolean; // 窗口常驻置顶，显示在所有应用前面（默认 true）
  bgAlpha?: number; // 背景不透明度 0.3 ~ 1（默认 1；越低越透，露出桌面）
  proxy?: ProxyConfig; // 实时 token 本地代理（可选）
}

export function emptyProvider(name = "新厂商"): ProviderConfig {
  return {
    name,
    enabled: false,
    apiKey: "",
    endpoint: null,
    mapping: null,
    gcpProject: null,
    gcpBillingAccount: null,
  };
}

export function defaultConfig(): Config {
  return {
    pollIntervalSecs: 300,
    openai: { ...emptyProvider("OpenAI"), enabled: true },
    deepseek: { ...emptyProvider("DeepSeek"), enabled: true },
    gemini: { ...emptyProvider("Gemini") },
    customProviders: [],
    petStyle: "cat",
    petImage: null,
    petPreset: "clawd-happy",
    compact: true,
    alwaysOnTop: true,
    bgAlpha: 1,
    proxy: { enabled: false, port: 8787 },
  };
}

const SYMBOLS: Record<string, string> = {
  USD: "$",
  CNY: "¥",
  EUR: "€",
  JPY: "¥",
};

export function fmtMoney(v: number | null, cur: string): string {
  if (v == null || Number.isNaN(v)) return "—";
  const sym = SYMBOLS[cur] || cur || "";
  const abs = Math.abs(v);
  const digits = abs >= 1000 ? 0 : 2;
  return sym + v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtNum(v: number | null): string {
  if (v == null || Number.isNaN(v)) return "—";
  return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

// 把背景不透明度（0.3 ~ 1）写进 CSS 变量 --bg-alpha，实时生效
export function applyBgAlpha(a: number): void {
  const v = Math.min(1, Math.max(0.3, a));
  document.documentElement.style.setProperty("--bg-alpha", String(v));
}
