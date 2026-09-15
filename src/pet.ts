// 拟人宠物形象（多套 SVG 样式）+ 情绪切换 + 上传图片替换。TokenPet · 三月个人专用
import type { PetStyle } from "./state";

export type Mood = "happy" | "neutral" | "worried";

export function renderPet(
  el: HTMLElement,
  opts: { image?: string | null; preset?: string | null; style?: PetStyle } = {}
): void {
  const base = (import.meta.env.BASE_URL || "./").replace(/\/$/, "") + "/";
  if (opts.image) {
    el.innerHTML = `<img class="pet-img" src="${opts.image}" alt="pet" draggable="false" />`;
    return;
  }
  if (opts.preset) {
    el.innerHTML = `<img class="pet-img" src="${base}pets/${opts.preset}.svg" alt="pet" draggable="false" />`;
    return;
  }
  const style = opts.style || "cat";
  if (style === "ghost") el.innerHTML = ghostSvg();
  else if (style === "robot") el.innerHTML = robotSvg();
  else el.innerHTML = catSvg();
}

export function setMood(m: Mood): void {
  const pet = document.querySelector(".pet");
  if (!pet) return;
  pet.classList.remove("mood-happy", "mood-neutral", "mood-worried");
  pet.classList.add("mood-" + m);
}

function catSvg(): string {
  return `
  <svg class="pet mood-happy" viewBox="0 0 200 200" width="156" height="156" aria-label="Token 喵">
    <g class="pet-body">
      <ellipse class="shadow" cx="100" cy="182" rx="46" ry="8"></ellipse>
      <g class="bob">
        <path class="ear" d="M60 72 L49 30 L88 58 Z"></path>
        <path class="ear" d="M140 72 L151 30 L112 58 Z"></path>
        <circle class="head" cx="100" cy="102" r="56"></circle>
        <circle class="cheek" cx="72" cy="118" r="9"></circle>
        <circle class="cheek" cx="128" cy="118" r="9"></circle>
        <g class="eyes">
          <ellipse class="eye-white" cx="80" cy="98" rx="13" ry="16"></ellipse>
          <ellipse class="eye-white" cx="120" cy="98" rx="13" ry="16"></ellipse>
          <circle class="pupil" cx="80" cy="100" r="7"></circle>
          <circle class="pupil" cx="120" cy="100" r="7"></circle>
          <circle class="glint" cx="83" cy="96" r="2.6"></circle>
          <circle class="glint" cx="123" cy="96" r="2.6"></circle>
        </g>
        <path class="mouth" d="M86 118 Q100 134 114 118"></path>
        <path class="sweat" d="M150 80 q7 11 0 18 q-7 -7 0 -18 Z"></path>
      </g>
    </g>
  </svg>`;
}

function ghostSvg(): string {
  return `
  <svg class="pet mood-happy" viewBox="0 0 200 200" width="150" height="156" aria-label="Token 幽灵">
    <g class="pet-body">
      <ellipse class="shadow" cx="100" cy="182" rx="42" ry="8"></ellipse>
      <g class="bob">
        <path class="head" d="M52 110 Q52 44 100 44 Q148 44 148 110 L148 160 L132 148 L116 160 L100 148 L84 160 L68 148 L52 160 Z"></path>
        <g class="eyes">
          <circle class="pupil" cx="82" cy="96" r="8"></circle>
          <circle class="pupil" cx="118" cy="96" r="8"></circle>
          <circle class="glint" cx="85" cy="92" r="2.6"></circle>
          <circle class="glint" cx="121" cy="92" r="2.6"></circle>
        </g>
        <ellipse class="cheek" cx="74" cy="112" rx="7" ry="4"></ellipse>
        <ellipse class="cheek" cx="126" cy="112" rx="7" ry="4"></ellipse>
        <path class="mouth" d="M90 116 Q100 126 110 116"></path>
      </g>
    </g>
  </svg>`;
}

function robotSvg(): string {
  return `
  <svg class="pet mood-happy" viewBox="0 0 200 200" width="152" height="156" aria-label="Token 机器人">
    <g class="pet-body">
      <ellipse class="shadow" cx="100" cy="182" rx="44" ry="8"></ellipse>
      <g class="bob">
        <rect class="ear" x="60" y="40" width="14" height="22" rx="4"></rect>
        <rect class="ear" x="126" y="40" width="14" height="22" rx="4"></rect>
        <rect class="head" x="48" y="56" width="104" height="86" rx="22"></rect>
        <rect x="64" y="74" width="72" height="34" rx="10" fill="#0c0e18"></rect>
        <g class="eyes">
          <circle class="pupil" cx="84" cy="91" r="8"></circle>
          <circle class="pupil" cx="116" cy="91" r="8"></circle>
          <circle class="glint" cx="86" cy="88" r="2.4"></circle>
          <circle class="glint" cx="118" cy="88" r="2.4"></circle>
        </g>
        <rect class="mouth" x="84" y="120" width="32" height="6" rx="3"></rect>
        <circle class="cheek" cx="70" cy="120" r="4"></circle>
        <circle class="cheek" cx="130" cy="120" r="4"></circle>
      </g>
    </g>
  </svg>`;
}
