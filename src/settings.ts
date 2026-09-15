// 设置弹窗：厂商 Token 配置（内置 + 任意数量自定义）、宠物图片上传。TokenPet · 三月个人专用
import { PET_PRESETS, applyBgAlpha, type Config, type ProviderConfig } from "./state";

type FixedKey = "openai" | "deepseek" | "gemini";

const FIXED: { key: FixedKey; name: string; hint: string }[] = [
  { key: "openai", name: "OpenAI (GPT)", hint: "API Key（需 billing 读取权限）" },
  { key: "deepseek", name: "DeepSeek", hint: "API Key" },
  { key: "gemini", name: "Gemini", hint: "Google Cloud 访问令牌（access token）" },
];

const esc = (s: string) => s.replace(/"/g, "&quot;");

export function openSettings(
  cfg: Config,
  onSave: (c: Config) => void,
  rerenderPet: () => void,
  onClose?: () => void
): void {
  const overlay = document.createElement("div");
  overlay.className = "overlay";

  const fixedBlocks = FIXED.map(({ key, name, hint }) => {
    const p = cfg[key];
    const extra =
      key === "gemini"
        ? `<input class="inp" data-key="${key}" data-field="gcpBillingAccount" placeholder="账单账号 billingAccounts/XXXXXX-XXXXXX-XXXXXX" value="${esc(p.gcpBillingAccount || "")}" />`
        : "";
    return `<div class="prov">
      <label class="prov-head"><input type="checkbox" data-enable="${key}" ${p.enabled ? "checked" : ""}/> <b>${name}</b></label>
      <div class="prov-body">
        <input class="inp" data-key="${key}" data-field="apiKey" placeholder="${hint}" value="${esc(p.apiKey || "")}" />
        ${extra}
      </div>
    </div>`;
  }).join("");

  overlay.innerHTML = `<div class="modal">
    <div class="modal-head">⚙ 设置 · 三月个人专用</div>
    <div class="modal-body">
      <label class="row-inline">刷新间隔(秒) <input class="inp small" id="interval" type="number" min="30" value="${cfg.pollIntervalSecs}" /></label>
      <label class="row-inline"><input type="checkbox" id="alwaysTop" ${(cfg.alwaysOnTop ?? true) ? "checked" : ""}/> 常驻置顶（显示在所有应用前面）</label>
      <label class="slider-row">背景不透明度
        <input type="range" id="bgAlpha" min="30" max="100" step="5" value="${Math.round((cfg.bgAlpha ?? 1) * 100)}" />
        <b id="bgAlphaVal">${Math.round((cfg.bgAlpha ?? 1) * 100)}%</b>
      </label>

      <div class="section-title">实时 token（本地代理 · 可选）</div>
      <div class="prov">
        <div class="prov-body">
          <label class="row-inline"><input type="checkbox" id="proxyOn" ${cfg.proxy?.enabled ? "checked" : ""}/> 启用实时 token 统计</label>
          <label class="row-inline">代理端口 <input class="inp small" id="proxyPort" type="number" min="1024" max="65535" value="${cfg.proxy?.port ?? 8787}"/></label>
          <div class="hint">先在终端运行 <b>node tools/token-proxy.mjs</b>，再把 LLM 客户端的 base_url 指到 <b>http://127.0.0.1:${cfg.proxy?.port ?? 8787}</b>，宠物头顶即会实时显示每次 prompt / completion 消耗（余额仍走官方账单接口）。</div>
        </div>
      </div>

      <div class="section-title">厂商 Token（勾选要显示的）</div>
      ${fixedBlocks}

      <div class="section-title">自定义 / 国内大模型（可添加多个）</div>
      <div id="customList"></div>
      <button class="btn ghost" id="addCustom" type="button" style="align-self:flex-start">＋ 添加厂商</button>

      <div class="section-title">宠物形象（点选切换 · 来自 GitHub clawd-pet）</div>
      <div class="prov">
        <div class="prov-body">
          <div class="pet-gallery" id="petGallery"></div>
          <input class="inp" id="petImage" type="file" accept="image/*" />
          <button class="btn ghost" id="resetPet" type="button">恢复默认形象</button>
          <div class="hint">点击任意宠物即可切换；也可上传自己的图片（透明 PNG / GIF）替换。形象保存在本机配置，即时预览。</div>
        </div>
      </div>

      <div class="hint">密钥仅保存在本机应用配置目录，不会上传。OpenAI / Gemini 官方账单接口有数小时延迟，并非逐句实时。</div>
    </div>
    <div class="modal-foot">
      <button class="btn ghost" id="cancel">取消</button>
      <button class="btn primary" id="save">保存</button>
    </div>
  </div>`;

  document.body.appendChild(overlay);
  const customList = overlay.querySelector("#customList") as HTMLElement;

  const renderCustomList = () => {
    customList.innerHTML = cfg.customProviders
      .map(
        (p, i) => `<div class="prov" data-index="${i}">
        <label class="prov-head">
          <input type="checkbox" data-custom="1" data-index="${i}" data-field="enabled" ${p.enabled ? "checked" : ""}/>
          <input class="inp small" data-custom="1" data-index="${i}" data-field="name" value="${esc(p.name)}" style="width:120px;margin-left:6px" />
          <button class="icon-btn" data-remove="${i}" title="删除" style="margin-left:auto">🗑</button>
        </label>
        <div class="prov-body">
          <input class="inp" data-custom="1" data-index="${i}" data-field="apiKey" placeholder="API Key" value="${esc(p.apiKey || "")}" />
          <input class="inp" data-custom="1" data-index="${i}" data-field="endpoint" placeholder="用量接口 URL（GET）" value="${esc(p.endpoint || "")}" />
          <textarea class="inp ta" data-custom="1" data-index="${i}" data-field="mapping" placeholder='字段映射 JSON，如 {"usedMonth":"$.used_month","balance":"$.balance","currency":"$.currency"}'>${
            p.mapping ? JSON.stringify(p.mapping) : ""
          }</textarea>
        </div>
      </div>`
      )
      .join("");
    customList.querySelectorAll("[data-remove]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt((btn as HTMLElement).dataset.remove as string, 10);
        cfg.customProviders.splice(idx, 1);
        renderCustomList();
      });
    });
  };
  renderCustomList();

  (overlay.querySelector("#addCustom") as HTMLButtonElement).addEventListener("click", () => {
    cfg.customProviders.push({
      name: "新厂商",
      enabled: true,
      apiKey: "",
      endpoint: null,
      mapping: null,
      gcpProject: null,
      gcpBillingAccount: null,
    });
    renderCustomList();
  });

  const gallery = overlay.querySelector("#petGallery") as HTMLElement;
  const base = (import.meta.env.BASE_URL || "./").replace(/\/$/, "") + "/";
  const syncGalleryActive = () => {
    gallery.querySelectorAll<HTMLButtonElement>(".pet-opt").forEach((b) => {
      const active = !cfg.petImage && b.dataset.preset === (cfg.petPreset || "clawd-happy");
      b.classList.toggle("active", active);
    });
  };
  const renderGallery = () => {
    gallery.innerHTML = PET_PRESETS.map(
      (p) =>
        `<button class="pet-opt" data-preset="${p.key}" type="button" title="${p.label}">
          <img src="${base}pets/${p.key}.svg" alt="${p.label}" draggable="false" />
          <span>${p.label}</span>
        </button>`
    ).join("");
    gallery.querySelectorAll<HTMLButtonElement>(".pet-opt").forEach((b) => {
      b.addEventListener("click", () => {
        cfg.petPreset = b.dataset.preset as string;
        cfg.petImage = null;
        syncGalleryActive();
        rerenderPet();
      });
    });
    syncGalleryActive();
  };
  renderGallery();

  const fileInput = overlay.querySelector("#petImage") as HTMLInputElement;
  fileInput.addEventListener("change", () => {
    const f = fileInput.files && fileInput.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      cfg.petImage = reader.result as string;
      cfg.petPreset = null; // 上传图片时清除预设
      syncGalleryActive();
      rerenderPet();
    };
    reader.readAsDataURL(f);
  });
  (overlay.querySelector("#resetPet") as HTMLButtonElement).addEventListener("click", () => {
    cfg.petImage = null;
    cfg.petPreset = "clawd-happy";
    syncGalleryActive();
    rerenderPet();
  });

  // 背景透明度（实时预览；取消则还原）
  const alphaInput = overlay.querySelector("#bgAlpha") as HTMLInputElement;
  const alphaVal = overlay.querySelector("#bgAlphaVal") as HTMLElement;
  const origAlpha = cfg.bgAlpha ?? 1;
  alphaInput.addEventListener("input", () => {
    const v = parseInt(alphaInput.value, 10) / 100;
    cfg.bgAlpha = v;
    alphaVal.textContent = `${alphaInput.value}%`;
    applyBgAlpha(v);
  });

  const closeWithoutSave = () => {
    cfg.bgAlpha = origAlpha;
    applyBgAlpha(origAlpha);
    overlay.remove();
    onClose?.();
  };
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeWithoutSave();
  });
  (overlay.querySelector("#cancel") as HTMLButtonElement).addEventListener("click", closeWithoutSave);

  (overlay.querySelector("#save") as HTMLButtonElement).addEventListener("click", () => {
    cfg.pollIntervalSecs = Math.max(30, parseInt((overlay.querySelector("#interval") as HTMLInputElement).value, 10) || 300);
    cfg.alwaysOnTop = (overlay.querySelector("#alwaysTop") as HTMLInputElement).checked;
    cfg.proxy = {
      enabled: (overlay.querySelector("#proxyOn") as HTMLInputElement).checked,
      port: Math.min(65535, Math.max(1024, parseInt((overlay.querySelector("#proxyPort") as HTMLInputElement).value, 10) || 8787)),
    };

    FIXED.forEach(({ key }) => {
      const p = cfg[key];
      const en = overlay.querySelector(`input[data-enable="${key}"]`) as HTMLInputElement;
      p.enabled = en.checked;
      overlay.querySelectorAll(`[data-key="${key}"]`).forEach((el) => {
        const field = (el as HTMLElement).dataset.field as keyof ProviderConfig;
        const value = (el as HTMLInputElement | HTMLTextAreaElement).value;
        (p as unknown as Record<string, unknown>)[field] = value;
      });
    });

    const next: ProviderConfig[] = [];
    customList.querySelectorAll(".prov").forEach((provEl) => {
      const get = (field: string) => {
        const el = provEl.querySelector(`[data-field="${field}"]`) as HTMLInputElement | HTMLTextAreaElement | null;
        return el ? el.value : "";
      };
      const enabledEl = provEl.querySelector('[data-field="enabled"]') as HTMLInputElement;
      let mapping: Record<string, string> | null = null;
      const m = get("mapping").trim();
      if (m) {
        try {
          mapping = JSON.parse(m);
        } catch {
          /* 保留 null */
        }
      }
      next.push({
        name: get("name") || "厂商",
        enabled: enabledEl.checked,
        apiKey: get("apiKey"),
        endpoint: get("endpoint") || null,
        mapping,
        gcpProject: null,
        gcpBillingAccount: null,
      });
    });
    cfg.customProviders = next;

    onSave(cfg);
    overlay.remove();
    onClose?.();
  });
}
