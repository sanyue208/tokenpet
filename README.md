# TokenPet · 三月个人专用

桌面宠物：常驻桌面的拟人小猫，实时显示你在 **OpenAI (GPT) / Gemini / DeepSeek / 国内大模型** 上的
token 消耗、余额与剩余额度。

> 技术栈：Tauri (Rust + 前端) · 数据来源：厂商官方账单/用量 API 轮询。

---

## 功能

- 🐾 拟人宠物形象（idle 动画 + 余额偏低时担忧表情）
- 🪟 桌面形态：透明无边框 + **常驻置顶**（显示在所有应用前面）；默认**简洁模式**只留宠物与头顶横幅，底部详情收进**可一键收起的抽屉**，收起时窗口同步变小、不遮挡其他窗口；背景**透明度可调**（设置里 30%–100% 滑块，越透越能看见桌面）
- ⚡ **实时 token（可选）**：跑一个零依赖本地代理 `tools/token-proxy.mjs`，把 LLM 请求的 base_url 指到它，宠物头顶实时显示每次 prompt / completion 与累计 token（毫秒级；余额仍走官方账单接口）
- 📊 每个平台一张卡片：今日消耗 / 本月消耗 / 余额 / 剩余 / 进度条
- 📣 宠物头顶**固定横幅条**，各平台 token 消耗 / 余额 / 剩余**逐行往上堆**显示（不滚动轮换；只用 transform/opacity 动画，尊重系统「减少动态效果」偏好）
- 🎨 宠物形象可换：内置 16 款来自 GitHub **clawd-pet** 的可爱动画宠物（开心 / 跳舞 / 游戏 / 魔法 …），设置里点选即换；也可上传自己的图片（透明 PNG / GIF）替换；配置持久化到本机
- ⚙ 设置弹窗：填写各平台 API Key、刷新间隔、常驻开关
- 🔌 可插拔 Provider 适配器，新增平台只需加一个适配器
- 🔒 API Key 仅保存在本机应用配置目录，不上传

> 宠物素材来自 [abderrahimghazali/clawd-pet](https://github.com/abderrahimghazali/clawd-pet)（MIT 许可），已下载至 `public/pets/`；每只宠物是自带 CSS 动画的 SVG，无需脚本即可动起来。

---

## 重要前提（数据可信度）

- OpenAI / Gemini 的**官方账单接口有数小时延迟**，显示的是「当日/当月聚合花费」，**不是逐句实时 token**。
- 各厂商账单接口返回的是**金额（USD/CNY）**，并非直接的 token 数。
- 想要**真正实时的逐次 token 消耗**，请启用下方的「实时 token（本地代理）」：把请求经过本地代理即可读到每次响应的 `usage`（精确、毫秒级）。余额仍走官方账单接口（余额不需要秒级）。
- 余额/剩余：OpenAI 可推算限额内剩余；DeepSeek 直接返回余额；Gemini 仅能拿到本月花费（Cloud Billing 不暴露余额）。
- **单位换算假设**：OpenAI 账单接口的 `total_usage` 视为**美分**（已 ÷100 转美元）。若你的账户返回值已是美元，请改 `src-tauri/src/providers/openai.rs` 中的 `/ 100.0`。各村接口字段可能随官方调整，首次接入请对照实际返回校准。

---

## 环境准备（在 Windows 本机）

1. 安装 [Rust](https://www.rust-lang.org/tools/install)（勾选 MSVC 工具链）
2. 安装 [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/)（Win11 通常已自带）
3. 安装 Node.js 18+
4. 进入项目目录安装前端依赖：
   ```powershell
   cd desktop-token-pet
   npm install
   ```

## 运行 / 构建

```powershell
npm run tauri dev      # 开发模式（热更新）
npm run tauri build    # 打包成 Windows 安装包（输出在 src-tauri/target/release/bundle）
```

> 首次 `tauri build` 若提示缺少图标，先准备一张 1024×1024 的 PNG，然后执行
> `npx tauri icon ./your-logo.png`（仓库已自带 `scripts/gen-icon.mjs` 生成的占位图标）。

---

## 实时 token（本地代理 · 可选，想要「实时」时开启）

官方账单接口有延迟（数分钟~数小时），拿不到逐句 token。要**实时**，就把请求经过本仓库自带的零依赖本地代理：

```powershell
# 1) 启动代理（默认 127.0.0.1:8787 → https://api.openai.com）
npm run proxy
# 或指定上游与端口
node tools/token-proxy.mjs --port 8787 --upstream https://api.deepseek.com
```

2) 把 LLM 客户端的 `base_url` 指到代理：
- OpenAI SDK：`base_url="http://127.0.0.1:8787/v1"`
- 任意兼容 OpenAI 协议的工具（LiteLLM / one-api / Cherry Studio / Chatbox…）同理

3) 打开宠物 → ⚙ 设置 → 勾选「启用实时 token 统计」并填端口。
头顶横幅与详情里的「实时 token」卡片会显示 **本次 ↑prompt ↓completion / 累计**，毫秒级刷新。

> 代理只做透传 + 读取 `usage`，不修改请求/响应，也不上传任何数据。兼容 OpenAI（`usage`，流式建议 `stream_options.include_usage`）、Anthropic（`input/output_tokens`）、Gemini（`usageMetadata`，累计语义）。
> 统计接口 `GET http://127.0.0.1:8787/__stats`，清零 `/__reset`。

---

## 各平台配置说明

| 平台 | 需要填什么 | 数据内容 |
| --- | --- | --- |
| **OpenAI** | API Key（需 billing 读取权限） | 今日/本月消耗、额度内剩余 |
| **DeepSeek** | API Key | 余额 / 剩余（CNY） |
| **Gemini** | Google Cloud 访问令牌 + 账单账号 `billingAccounts/XXXX` | 仅本月消耗 |
| **自定义/国内** | API Key + 用量接口 URL + 字段映射 JSON | 按映射解析任意结构 |

### 自定义适配器字段映射示例

把某个返回 JSON 的用量接口填入「用量接口 URL」，再填映射：

```json
{
  "usedToday": "$.used_today",
  "usedMonth": "$.used_month",
  "balance": "$.balance",
  "limit": "$.limit",
  "currency": "$.currency"
}
```

支持 `$.a.b.c` 和 `$.a[0].b` 形式的路径。

---

## 打包成 exe（两种方式）

**方式一：本机直接构建（需已装 Rust）**
```powershell
npm run tauri build
```
产物位置：
- 安装包：`src-tauri/target/release/bundle/msi/*.msi` 与 `bundle/nsis/*.exe`
- 裸 exe：`src-tauri/target/release/desktop-token-pet.exe`（可直接双击运行，需本机有 WebView2）

**方式二：GitHub Actions 云端构建（无需本机装 Rust）**
仓库已包含 `.github/workflows/build-windows.yml`（在 `windows-latest`  runner 上用 MSVC 工具链编译，产出真正的 Windows exe）。在 GitHub 上：
1. `git tag v0.1.0 && git push --tags`，或到 Actions 页面手动 `Run workflow`；
2. 跑完后到 `Artifacts` 下载 `TokenPet-windows`，里面就是 exe / 安装包。

> 注：当前开发沙箱环境**未安装 Rust 工具链**，无法在本机直接 `tauri build` 出 exe；本地 Rust 路径仅适用于你自己的 Windows 电脑。云端构建（方式二）不依赖本地环境，是最稳的出包方式。

> 若启用 Tauri 自动更新签名，需在仓库 Secrets 配置 `TAURI_SIGNING_PRIVATE_KEY` 等；不用自动更新可忽略。

---

## 目录结构

```
desktop-token-pet/
├── index.html
├── vite.config.ts
├── public/
│   └── pets/                # GitHub clawd-pet 动画 SVG（16 款可换宠物）
├── tools/
│   └── token-proxy.mjs      # 实时 token 本地代理（零依赖，透传 + 读 usage）
├── src/                     # 前端（宠物 UI / 卡片 / 设置）
│   ├── main.ts
│   ├── banner.ts             # 头顶固定横幅（逐行往上堆）
│   ├── pet.ts
│   ├── panels.ts
│   ├── settings.ts
│   ├── state.ts
│   ├── tauri-api.ts         # 双模式：Tauri 真数据 / 浏览器 mock 预览
│   └── style.css
├── src-tauri/               # Rust 后端
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/default.json
│   └── src/
│       ├── main.rs
│       ├── config.rs
│       ├── poll.rs
│       └── providers/
│           ├── mod.rs
│           ├── model.rs
│           ├── openai.rs
│           ├── deepseek.rs
│           ├── gemini.rs
│           └── custom.rs
└── scripts/gen-icon.mjs     # 生成图标
```
