// 宠物头顶的 token 消耗固定横幅（逐行往上堆，不滚动轮换）。TokenPet · 三月个人专用
// 动效仅用 transform/opacity；动态内容用 aria-live；尊重 prefers-reduced-motion。
let bannerEl: HTMLElement | null = null;

const COIN = `<svg class="banner-ico" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="#ffcf5c" stroke="#b8860b" stroke-width="1.5"/><path d="M12 7v10M9 9.5h4.2a2 2 0 0 1 0 4H9" stroke="#7a5b00" stroke-width="1.6" stroke-linecap="round"/></svg>`;

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

export function setupBanner(container: HTMLElement): void {
  container.innerHTML = `<div class="banner" aria-live="polite"></div>`;
  bannerEl = container.querySelector(".banner");
}

// 所有厂商的消耗一次性铺开、逐行向上堆叠，不再逐条轮换。
export function setBannerMessages(list: string[]): void {
  if (!bannerEl) return;
  const msgs = list.filter((m) => m && m.trim().length > 0);
  if (msgs.length === 0) {
    bannerEl.innerHTML = `<div class="banner-row"><span class="banner-text">暂无数据 · 点 ⚙ 配置厂商</span></div>`;
    return;
  }
  bannerEl.innerHTML = msgs
    .map((m) => `<div class="banner-row">${COIN}<span class="banner-text">${escapeHtml(m)}</span></div>`)
    .join("");
}
