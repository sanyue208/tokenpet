// TokenPet 实时 token 统计代理 · 零依赖 · 三月个人专用
// 作用：把 LLM 请求透传到厂商 API，同时读取每次响应的 usage，实时累计。
// 用法：
//   node tools/token-proxy.mjs                       # 默认 127.0.0.1:8787 → https://api.openai.com
//   node tools/token-proxy.mjs --port 8787 --upstream https://api.deepseek.com
// 然后把你的客户端 base_url 指到 http://127.0.0.1:8787 ；统计接口 GET /__stats
import http from "node:http";
import https from "node:https";

const args = process.argv.slice(2);
const getArg = (n, d) => {
  const i = args.indexOf("--" + n);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};

const PORT = parseInt(getArg("port", process.env.TOKEN_PROXY_PORT || "8787"), 10);
const UPSTREAM = getArg("upstream", process.env.TOKEN_PROXY_UPSTREAM || "https://api.openai.com");
let upstream;
try {
  upstream = new URL(UPSTREAM);
} catch {
  console.error("[token-proxy] 无效的 --upstream:", UPSTREAM);
  process.exit(1);
}
const transport = upstream.protocol === "https:" ? https : http;

const state = {
  startedAt: Date.now(),
  totalRequests: 0,
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  last: null,
  models: {},
  history: [],
};

const num = (...vals) => {
  for (const v of vals) if (typeof v === "number" && !Number.isNaN(v)) return v;
  return 0;
};

// 兼容 OpenAI / Anthropic / Gemini 的 usage 字段
function extractUsage(obj) {
  if (!obj || typeof obj !== "object") return null;
  const u = obj.usage || obj.usageMetadata;
  if (!u) return null;
  const prompt = num(u.prompt_tokens, u.input_tokens, u.promptTokenCount);
  const completion = num(u.completion_tokens, u.output_tokens, u.candidatesTokenCount);
  let total = num(u.total_tokens, u.totalTokenCount);
  if (!total) total = prompt + completion;
  if (!prompt && !completion && !total) return null;
  return { prompt, completion, total, model: obj.model || null };
}

// 流式下各厂商语义不同：多为「累计」或「最后一帧才给」，故用最新值覆盖
function mergeUsage(acc, u) {
  if (!u) return acc;
  if (u.prompt) acc.prompt = u.prompt;
  if (u.completion) acc.completion = u.completion;
  if (u.total) acc.total = u.total;
  acc.model = u.model || acc.model;
  if (!acc.total) acc.total = acc.prompt + acc.completion;
  return acc;
}

function record(u, model, path) {
  if (!u) return;
  const rec = {
    prompt: u.prompt | 0,
    completion: u.completion | 0,
    total: u.total | 0,
    model: model || "unknown",
    ts: Date.now(),
    path,
  };
  state.totalRequests++;
  state.promptTokens += rec.prompt;
  state.completionTokens += rec.completion;
  state.totalTokens += rec.total;
  state.last = rec;
  state.history.push(rec);
  if (state.history.length > 50) state.history.shift();
  const m = (state.models[rec.model] ||= { requests: 0, prompt: 0, completion: 0, total: 0 });
  m.requests++;
  m.prompt += rec.prompt;
  m.completion += rec.completion;
  m.total += rec.total;
  console.log(`[token-proxy] ${rec.model}  ↑${rec.prompt} ↓${rec.completion} = ${rec.total} tok  (累计 ${state.totalTokens})`);
}

function stats() {
  return {
    ok: true,
    uptimeMs: Date.now() - state.startedAt,
    upstream: upstream.origin,
    totalRequests: state.totalRequests,
    promptTokens: state.promptTokens,
    completionTokens: state.completionTokens,
    totalTokens: state.totalTokens,
    last: state.last,
    models: state.models,
    history: state.history.slice(-20),
  };
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Max-Age": "86400",
};

// 逐跳头 + accept-encoding（去掉压缩，便于解析 usage）
const STRIP = new Set([
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "content-length",
  "accept-encoding",
]);

function cleanHeaders(h) {
  const out = {};
  for (const k of Object.keys(h)) if (!STRIP.has(k.toLowerCase())) out[k] = h[k];
  return out;
}

const json = (res, code, body) =>
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...CORS }).end(body);

const server = http.createServer((req, res) => {
  const url = req.url || "/";

  if (url === "/__stats" || url === "/__stats/" || url === "/" || url === "/health") {
    json(res, 200, JSON.stringify(stats()));
    return;
  }
  if (url === "/__reset") {
    Object.assign(state, { totalRequests: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, last: null, models: {}, history: [] });
    json(res, 200, JSON.stringify({ ok: true }));
    return;
  }
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  const reqChunks = [];
  req.on("data", (c) => reqChunks.push(c));
  req.on("error", () => {});
  req.on("end", () => {
    const reqBody = Buffer.concat(reqChunks);
    let model = null;
    if (reqBody.length) {
      try {
        model = JSON.parse(reqBody.toString("utf8")).model || null;
      } catch {
        /* 非 JSON 请求体，忽略 */
      }
    }

    const upReq = transport.request(
      {
        protocol: upstream.protocol,
        hostname: upstream.hostname,
        port: upstream.port || (upstream.protocol === "https:" ? 443 : 80),
        method: req.method,
        path: url,
        headers: cleanHeaders(req.headers),
      },
      (upRes) => {
        res.writeHead(upRes.statusCode || 502, cleanHeaders(upRes.headers));
        const ctype = String(upRes.headers["content-type"] || "");

        if (ctype.includes("text/event-stream")) {
          const acc = { prompt: 0, completion: 0, total: 0, model };
          let buf = "";
          upRes.on("data", (chunk) => {
            res.write(chunk);
            buf += chunk.toString("utf8");
            const lines = buf.split(/\r?\n/);
            buf = lines.pop() || "";
            for (const line of lines) {
              const t = line.trim();
              if (!t.startsWith("data:")) continue;
              const payload = t.slice(5).trim();
              if (!payload || payload === "[DONE]") continue;
              try {
                mergeUsage(acc, extractUsage(JSON.parse(payload)));
              } catch {
                /* 半包/非 JSON，忽略 */
              }
            }
          });
          upRes.on("end", () => {
            res.end();
            if (acc.prompt || acc.completion || acc.total) record(acc, acc.model || model, url);
          });
        } else if (ctype.includes("application/json")) {
          const chunks = [];
          upRes.on("data", (c) => chunks.push(c));
          upRes.on("end", () => {
            const buf = Buffer.concat(chunks);
            try {
              record(extractUsage(JSON.parse(buf.toString("utf8"))), model, url);
            } catch {
              /* 忽略 */
            }
            res.end(buf);
          });
        } else {
          upRes.pipe(res);
        }
      }
    );

    upReq.on("error", (e) => {
      json(res, 502, JSON.stringify({ ok: false, error: String((e && e.message) || e) }));
    });

    if (reqBody.length) upReq.write(reqBody);
    upReq.end();
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[token-proxy] 监听 http://127.0.0.1:${PORT}  →  ${upstream.origin}`);
  console.log(`[token-proxy] 把 LLM 客户端 base_url 指到 http://127.0.0.1:${PORT} 即可实时统计`);
  console.log(`[token-proxy] 统计接口：http://127.0.0.1:${PORT}/__stats   清零：/__reset`);
});
