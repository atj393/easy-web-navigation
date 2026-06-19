/**
 * Generate Easy Web Navigation extension icons (16/32/48/128) as PNGs, plus an
 * SVG source, using only Node built-ins (no external dependencies, no network).
 *
 * Design: a rounded blue square (brand), a white "focus ring", and three white
 * dots on a diagonal (the keyboard "tab path"). Rendered with 4x supersampling
 * for clean anti-aliased edges.
 *
 * The PNGs are committed, so contributors never need to run this. Re-run with:
 *   node scripts/generate-icons.mjs
 */
import zlib from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(PKG_ROOT, "public");
const SIZES = [16, 32, 48, 128];
const SS = 4; // supersampling factor

const BLUE = [37, 99, 235];
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
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
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

// --- geometry helpers (coordinates in [0,1]) -----------------------------
function insideRoundedRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const ix = Math.min(Math.max(x, x0 + r), x1 - r);
  const iy = Math.min(Math.max(y, y0 + r), y1 - r);
  const dx = x - ix;
  const dy = y - iy;
  return dx * dx + dy * dy <= r * r;
}

function insideCircle(x, y, cx, cy, r) {
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

const DOTS = [
  [0.355, 0.645],
  [0.5, 0.5],
  [0.645, 0.355],
];

/** Return [r,g,b,a] (0..255) for a point in [0,1]. */
function sample(x, y) {
  // Background rounded square (brand blue), transparent outside.
  if (!insideRoundedRect(x, y, 0.04, 0.04, 0.96, 0.96, 0.22)) return [0, 0, 0, 0];

  // Focus ring (white): between an outer and inner rounded rect.
  const inOuter = insideRoundedRect(x, y, 0.17, 0.17, 0.83, 0.83, 0.2);
  const inInner = insideRoundedRect(x, y, 0.26, 0.26, 0.74, 0.74, 0.14);
  if (inOuter && !inInner) return [...WHITE, 255];

  // Tab-path dots (white).
  for (const [cx, cy] of DOTS) if (insideCircle(x, y, cx, cy, 0.058)) return [...WHITE, 255];

  return [...BLUE, 255];
}

function render(size) {
  const big = size * SS;
  const rgba = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px * SS + sx + 0.5) / big;
          const y = (py * SS + sy + 0.5) / big;
          const [sr, sg, sb, sa] = sample(x, y);
          // premultiply for correct edge blending
          r += (sr * sa) / 255;
          g += (sg * sa) / 255;
          b += (sb * sa) / 255;
          a += sa;
        }
      }
      const n = SS * SS;
      const aAvg = a / n;
      const i = (py * size + px) * 4;
      if (aAvg <= 0) {
        rgba[i] = rgba[i + 1] = rgba[i + 2] = rgba[i + 3] = 0;
      } else {
        // un-premultiply
        rgba[i] = Math.round((r / n / aAvg) * 255);
        rgba[i + 1] = Math.round((g / n / aAvg) * 255);
        rgba[i + 2] = Math.round((b / n / aAvg) * 255);
        rgba[i + 3] = Math.round(aAvg);
      }
    }
  }
  return encodePNG(size, size, rgba);
}

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" role="img" aria-label="Easy Web Navigation icon">
  <rect x="5" y="5" width="118" height="118" rx="28" fill="#2563eb"/>
  <rect x="22" y="22" width="84" height="84" rx="22" fill="none" stroke="#ffffff" stroke-width="11"/>
  <circle cx="45" cy="83" r="7.4" fill="#ffffff"/>
  <circle cx="64" cy="64" r="7.4" fill="#ffffff"/>
  <circle cx="83" cy="45" r="7.4" fill="#ffffff"/>
</svg>
`;

mkdirSync(OUT, { recursive: true });
// The SVG source lives at the package root (NOT in public/), so it is not
// copied into the built extension / store ZIP. Only the PNGs ship.
writeFileSync(join(PKG_ROOT, "icon-source.svg"), SVG);
for (const size of SIZES) {
  writeFileSync(join(OUT, `icon-${size}.png`), render(size));
  console.log(`wrote icon-${size}.png`);
}
console.log("wrote icon-source.svg (package root)");
