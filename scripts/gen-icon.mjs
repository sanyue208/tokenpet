// 生成 TokenPet 应用图标（PNG + ICO），无需任何第三方依赖。
// 用法：node scripts/gen-icon.mjs
import { writeFileSync, mkdirSync } from "fs";
import { deflateSync } from "zlib";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "src-tauri", "icons");
mkdirSync(OUT_DIR, { recursive: true });

const W = 256;

// ---- CRC32 ----
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])) >>> 0, 0);
  return Buffer.concat([len, t, data, crc]);
}

// ---- 像素绘制 ----
const px = Buffer.alloc(W * W * 4);
function setPx(x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= W || y >= W) return;
  const i = (y * W + x) * 4;
  px[i] = r;
  px[i + 1] = g;
  px[i + 2] = b;
  px[i + 3] = a;
}
function inRoundRect(x, y, cx, cy, hw, hh, rad) {
  const dx = Math.abs(x - cx) - hw + rad;
  const dy = Math.abs(y - cy) - hh + rad;
  const ox = Math.max(dx, 0);
  const oy = Math.max(dy, 0);
  return ox * ox + oy * oy <= rad * rad && Math.abs(x - cx) <= hw && Math.abs(y - cy) <= hh;
}

for (let y = 0; y < W; y++) {
  for (let x = 0; x < W; x++) {
    const cx = W / 2,
      cy = W / 2,
      hw = W * 0.36,
      hh = W * 0.36,
      rad = W * 0.22;
    if (inRoundRect(x, y, cx, cy, hw, hh, rad)) {
      const t = y / W;
      const r = Math.round(108 + (155 - 108) * t);
      const g = Math.round(92 + (89 - 92) * t);
      const b = Math.round(231 + (198 - 231) * t);
      setPx(x, y, r, g, b, 255);
    }
  }
}
function eye(ex, ey) {
  for (let y = -14; y <= 14; y++)
    for (let x = -14; x <= 14; x++) {
      const d = Math.sqrt(x * x + y * y);
      if (d <= 14) setPx(ex + x, ey + y, 255, 255, 255, 255);
      if (d <= 7) setPx(ex + x, ey + y, 40, 40, 60, 255);
    }
}
eye(Math.round(W * 0.5 - 34), Math.round(W * 0.5 - 18));
eye(Math.round(W * 0.5 + 34), Math.round(W * 0.5 - 18));
for (let a = -22; a <= 22; a += 1) {
  const x = Math.round(W * 0.5 + a);
  const y = Math.round(W * 0.5 + 30 + Math.sin((a / 22) * Math.PI) * 6);
  for (let dx = -3; dx <= 3; dx++)
    for (let dy = -3; dy <= 3; dy++)
      if (Math.sqrt(dx * dx + dy * dy) <= 3) setPx(x + dx, y + dy, 255, 255, 255, 255);
}

// ---- PNG ----
const raw = Buffer.alloc(W * W * 4 + W);
for (let y = 0; y < W; y++) {
  raw[y * (W * 4 + 1)] = 0;
  px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(W, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type RGBA
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;
const idat = deflateSync(raw);
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", ihdr),
  chunk("IDAT", idat),
  chunk("IEND", Buffer.alloc(0)),
]);
writeFileSync(`${OUT_DIR}/icon.png`, png);

// ---- ICO (PNG wrapped) ----
const hdr = Buffer.alloc(6);
hdr.writeUInt16LE(0, 0);
hdr.writeUInt16LE(1, 2);
hdr.writeUInt16LE(1, 4);
const entry = Buffer.alloc(16);
entry[0] = W & 0xff;
entry[1] = W & 0xff;
entry[2] = 0;
entry[3] = 0;
entry.writeUInt16LE(1, 4);
entry.writeUInt16LE(32, 6);
entry.writeUInt32LE(png.length, 8);
entry.writeUInt32LE(22, 12);
const ico = Buffer.concat([hdr, entry, png]);
writeFileSync(`${OUT_DIR}/icon.ico`, ico);

console.log("icons generated:", `${OUT_DIR}/icon.png`, `${OUT_DIR}/icon.ico`);
