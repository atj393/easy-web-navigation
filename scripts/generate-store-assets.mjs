/**
 * Generate original, branded store promo/logo PNGs for Easy Web Navigation,
 * using only Node built-ins (no dependencies, no network, no external assets).
 *
 * Outputs (docs/store/assets):
 *   chrome-small-promo-440x280.png  — Chrome Web Store small promo tile
 *   edge-logo-300x300.png           — Edge Add-ons logo
 *
 * These are REAL brand artwork (the focus-ring + tab-path motif on the brand
 * blue), not screenshots. Product screenshots cannot be faked — see
 * docs/store/screenshot-plan.md and the SVG placeholder in this folder.
 *
 *   node scripts/generate-store-assets.mjs
 */
import zlib from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "docs", "store", "assets");
const SS = 4;
const BLUE = [37, 99, 235];
const DEEP = [29, 78, 216];
const WHITE = [255, 255, 255];

// --- tiny PNG encoder (RGBA, 8-bit) --------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- geometry (coordinates normalized to the SHORTER side, centered) -----
function insideCircle(x, y, cx, cy, r) {
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}
function insideRing(x, y, cx, cy, outer, inner, half) {
  // square ring (rounded-ish via circle corners would need more; keep a band)
  const dx = Math.abs(x - cx);
  const dy = Math.abs(y - cy);
  const onOuter = dx <= outer && dy <= outer;
  const onInner = dx <= inner && dy <= inner;
  void half;
  return onOuter && !onInner;
}

/** Draw the brand motif (focus ring + 3 diagonal dots) centered. */
function motif(x, y, cx, cy, s) {
  // s = motif radius (half-size). Ring band:
  if (insideRing(x, y, cx, cy, s, s * 0.66)) return WHITE;
  const d = s * 0.16;
  if (insideCircle(x, y, cx - s * 0.34, cy + s * 0.34, d)) return WHITE;
  if (insideCircle(x, y, cx, cy, d)) return WHITE;
  if (insideCircle(x, y, cx + s * 0.34, cy - s * 0.34, d)) return WHITE;
  return null;
}

function lerp(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function render(width, height) {
  const rgba = Buffer.alloc(width * height * 4);
  const cx = width / 2;
  const cy = height / 2;
  const s = Math.min(width, height) * 0.3;
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = px + (sx + 0.5) / SS;
          const y = py + (sy + 0.5) / SS;
          // Vertical brand gradient background.
          const bg = lerp(BLUE, DEEP, y / height);
          const m = motif(x, y, cx, cy, s);
          const c = m ?? bg;
          r += c[0];
          g += c[1];
          b += c[2];
        }
      }
      const n = SS * SS;
      const i = (py * width + px) * 4;
      rgba[i] = Math.round(r / n);
      rgba[i + 1] = Math.round(g / n);
      rgba[i + 2] = Math.round(b / n);
      rgba[i + 3] = 255;
    }
  }
  return encodePNG(width, height, rgba);
}

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "chrome-small-promo-440x280.png"), render(440, 280));
console.log("wrote chrome-small-promo-440x280.png");
writeFileSync(join(OUT, "edge-logo-300x300.png"), render(300, 300));
console.log("wrote edge-logo-300x300.png");
