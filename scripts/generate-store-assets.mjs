/**
 * Generate Easy Web Navigation store / GitHub brand assets from the OFFICIAL
 * brand source, using only Node built-ins (no dependencies, no network).
 *
 * Source of truth (canonical, user-provided original artwork):
 *   assets/brand/easy-web-navigation-icon-source.png
 *
 * Outputs:
 *   docs/store/assets/edge-logo-300x300.png          — Edge Add-ons logo (icon)
 *   docs/store/assets/chrome-small-promo-440x280.png — clean promo tile
 *                                                       (icon + product name)
 *   docs/assets/easy-web-navigation-icon.png         — README / GitHub icon
 *
 * These are honest brand artwork built from the real icon — NOT screenshots and
 * NOT fake UI. Product screenshots cannot be faked; see docs/store/screenshot-plan.md.
 *
 *   node scripts/generate-store-assets.mjs
 */
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { decodePNG, encodePNG, resizeRGBA } from "./lib/png.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(ROOT, "assets", "brand", "easy-web-navigation-icon-source.png");
const STORE = join(ROOT, "docs", "store", "assets");
const DOCS = join(ROOT, "docs", "assets");

const src = decodePNG(readFileSync(SOURCE));
console.log(`source: ${SOURCE} (${src.width}×${src.height})`);

const WHITE = [255, 255, 255];

/** Sample the dominant brand blue from the source (strongly-blue pixels). */
function brandBlue(img) {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  const { data, width, height } = img;
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    const R = data[o];
    const G = data[o + 1];
    const B = data[o + 2];
    if (B > R + 40 && B > G + 25) {
      r += R;
      g += G;
      b += B;
      n += 1;
    }
  }
  return n ? [Math.round(r / n), Math.round(g / n), Math.round(b / n)] : [21, 101, 192];
}
const BLUE = brandBlue(src);

// --- monoline uppercase stroke font (only the glyphs the wordmark needs) ---
// Coordinates: x in [0, width], y in [0 (top) .. 1 (bottom, = cap height)].
const GLYPHS = {
  " ": { w: 0.42, s: [] },
  E: {
    w: 0.55,
    s: [
      [
        [0, 0],
        [0, 1],
      ],
      [
        [0, 0],
        [0.55, 0],
      ],
      [
        [0, 0.5],
        [0.46, 0.5],
      ],
      [
        [0, 1],
        [0.55, 1],
      ],
    ],
  },
  A: {
    w: 0.64,
    s: [
      [
        [0, 1],
        [0.32, 0],
        [0.64, 1],
      ],
      [
        [0.13, 0.64],
        [0.51, 0.64],
      ],
    ],
  },
  S: {
    w: 0.56,
    s: [
      [
        [0.55, 0.17],
        [0.42, 0.03],
        [0.18, 0.02],
        [0.03, 0.19],
        [0.06, 0.4],
        [0.3, 0.5],
        [0.48, 0.57],
        [0.54, 0.74],
        [0.42, 0.96],
        [0.16, 0.98],
        [0.02, 0.83],
      ],
    ],
  },
  Y: {
    w: 0.6,
    s: [
      [
        [0, 0],
        [0.3, 0.52],
      ],
      [
        [0.6, 0],
        [0.3, 0.52],
      ],
      [
        [0.3, 0.52],
        [0.3, 1],
      ],
    ],
  },
  W: {
    w: 0.96,
    s: [
      [
        [0, 0],
        [0.22, 1],
        [0.48, 0.36],
        [0.74, 1],
        [0.96, 0],
      ],
    ],
  },
  B: {
    w: 0.6,
    s: [
      [
        [0, 0],
        [0, 1],
      ],
      [
        [0, 0],
        [0.4, 0],
        [0.58, 0.14],
        [0.58, 0.36],
        [0.4, 0.5],
        [0, 0.5],
      ],
      [
        [0, 0.5],
        [0.45, 0.5],
        [0.63, 0.66],
        [0.63, 0.84],
        [0.45, 1],
        [0, 1],
      ],
    ],
  },
  N: {
    w: 0.64,
    s: [
      [
        [0, 1],
        [0, 0],
        [0.64, 1],
        [0.64, 0],
      ],
    ],
  },
  V: {
    w: 0.62,
    s: [
      [
        [0, 0],
        [0.31, 1],
        [0.62, 0],
      ],
    ],
  },
  I: {
    w: 0.12,
    s: [
      [
        [0.06, 0],
        [0.06, 1],
      ],
    ],
  },
  G: {
    w: 0.68,
    s: [
      [
        [0.66, 0.2],
        [0.52, 0.04],
        [0.3, 0.02],
        [0.1, 0.16],
        [0.03, 0.4],
        [0.05, 0.64],
        [0.2, 0.9],
        [0.44, 0.99],
        [0.64, 0.9],
        [0.68, 0.66],
        [0.68, 0.55],
        [0.42, 0.55],
      ],
    ],
  },
  T: {
    w: 0.58,
    s: [
      [
        [0, 0],
        [0.58, 0],
      ],
      [
        [0.29, 0],
        [0.29, 1],
      ],
    ],
  },
  O: {
    w: 0.72,
    s: [
      (() => {
        const pts = [];
        const cx = 0.36;
        const cy = 0.5;
        const rx = 0.33;
        const ry = 0.49;
        for (let k = 0; k <= 28; k++) {
          const t = (k / 28) * Math.PI * 2;
          pts.push([cx + rx * Math.sin(t), cy - ry * Math.cos(t)]);
        }
        return pts;
      })(),
    ],
  },
  K: {
    w: 0.6,
    s: [
      [
        [0, 0],
        [0, 1],
      ],
      [
        [0.56, 0],
        [0, 0.5],
      ],
      [
        [0, 0.5],
        [0.58, 1],
      ],
    ],
  },
  R: {
    w: 0.6,
    s: [
      [
        [0, 1],
        [0, 0],
      ],
      [
        [0, 0],
        [0.46, 0],
        [0.6, 0.13],
        [0.6, 0.32],
        [0.46, 0.48],
        [0, 0.48],
      ],
      [
        [0.26, 0.48],
        [0.6, 1],
      ],
    ],
  },
  D: {
    w: 0.64,
    s: [
      [
        [0, 0],
        [0, 1],
      ],
      [
        [0, 0],
        [0.34, 0],
        [0.6, 0.22],
        [0.6, 0.78],
        [0.34, 1],
        [0, 1],
      ],
    ],
  },
  C: {
    w: 0.64,
    s: [
      [
        [0.6, 0.2],
        [0.46, 0.04],
        [0.26, 0.02],
        [0.09, 0.16],
        [0.03, 0.4],
        [0.05, 0.64],
        [0.2, 0.9],
        [0.42, 0.99],
        [0.6, 0.85],
      ],
    ],
  },
  H: {
    w: 0.62,
    s: [
      [
        [0, 0],
        [0, 1],
      ],
      [
        [0.62, 0],
        [0.62, 1],
      ],
      [
        [0, 0.5],
        [0.62, 0.5],
      ],
    ],
  },
};

const LETTER_SPACING = 0.14; // in cap-height units

function textWidth(text, cap) {
  let w = 0;
  for (let i = 0; i < text.length; i++) {
    const g = GLYPHS[text[i]];
    w += (g ? g.w : 0.5) * cap;
    if (i < text.length - 1) w += LETTER_SPACING * cap;
  }
  return w;
}

/** Distance from point (px,py) to segment (ax,ay)-(bx,by). */
function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/**
 * Draw `text` (uppercase) centered at (centerX, topY) with the given cap height
 * onto an RGBA canvas. Returns nothing; mutates `buf`. Anti-aliased via the
 * supersample factor SS by testing sub-samples per pixel.
 */
function drawText(buf, W, H, text, centerX, topY, cap, color) {
  const stroke = cap * 0.115; // monoline thickness
  const half = stroke / 2;
  const total = textWidth(text, cap);
  let penX = centerX - total / 2;

  // Collect absolute segments for the whole string.
  const segs = [];
  let minX = Infinity;
  let maxX = -Infinity;
  for (const ch of text) {
    const g = GLYPHS[ch] ?? GLYPHS[" "];
    for (const poly of g.s) {
      for (let k = 0; k < poly.length - 1; k++) {
        const ax = penX + poly[k][0] * cap;
        const ay = topY + poly[k][1] * cap;
        const bx = penX + poly[k + 1][0] * cap;
        const by = topY + poly[k + 1][1] * cap;
        segs.push([ax, ay, bx, by]);
        minX = Math.min(minX, ax, bx);
        maxX = Math.max(maxX, ax, bx);
      }
    }
    penX += g.w * cap + LETTER_SPACING * cap;
  }

  const x0 = Math.max(0, Math.floor(minX - half - 1));
  const x1 = Math.min(W, Math.ceil(maxX + half + 1));
  const y0 = Math.max(0, Math.floor(topY - half - 1));
  const y1 = Math.min(H, Math.ceil(topY + cap + half + 1));
  const SS = 4;

  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      let hits = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const fx = px + (sx + 0.5) / SS;
          const fy = py + (sy + 0.5) / SS;
          let inside = false;
          for (const s of segs) {
            if (distSeg(fx, fy, s[0], s[1], s[2], s[3]) <= half) {
              inside = true;
              break;
            }
          }
          if (inside) hits += 1;
        }
      }
      if (hits === 0) continue;
      const a = hits / (SS * SS);
      const i = (py * W + px) * 4;
      // composite color over existing pixel
      buf[i] = Math.round(color[0] * a + buf[i] * (1 - a));
      buf[i + 1] = Math.round(color[1] * a + buf[i + 1] * (1 - a));
      buf[i + 2] = Math.round(color[2] * a + buf[i + 2] * (1 - a));
      buf[i + 3] = 255;
    }
  }
}

/** Alpha-composite a resized icon onto a canvas at (ox, oy). */
function blit(buf, W, icon, iw, ih, ox, oy) {
  for (let y = 0; y < ih; y++) {
    for (let x = 0; x < iw; x++) {
      const si = (y * iw + x) * 4;
      const a = icon[si + 3] / 255;
      if (a <= 0) continue;
      const di = ((oy + y) * W + (ox + x)) * 4;
      buf[di] = Math.round(icon[si] * a + buf[di] * (1 - a));
      buf[di + 1] = Math.round(icon[si + 1] * a + buf[di + 1] * (1 - a));
      buf[di + 2] = Math.round(icon[si + 2] * a + buf[di + 2] * (1 - a));
      buf[di + 3] = 255;
    }
  }
}

function solidCanvas(W, H, color) {
  const buf = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    buf[i * 4] = color[0];
    buf[i * 4 + 1] = color[1];
    buf[i * 4 + 2] = color[2];
    buf[i * 4 + 3] = 255;
  }
  return buf;
}

mkdirSync(STORE, { recursive: true });
mkdirSync(DOCS, { recursive: true });

// 1) Edge Add-ons logo — the icon at 300×300.
writeFileSync(
  join(STORE, "edge-logo-300x300.png"),
  encodePNG(300, 300, resizeRGBA(src.data, src.width, src.height, 300, 300)),
);
console.log("wrote edge-logo-300x300.png");

// 2) README / GitHub icon — the icon at 512×512.
writeFileSync(
  join(DOCS, "easy-web-navigation-icon.png"),
  encodePNG(512, 512, resizeRGBA(src.data, src.width, src.height, 512, 512)),
);
console.log("wrote easy-web-navigation-icon.png");

// 3) Chrome small promo tile — clean white tile: real icon + product name.
//    Visual hierarchy: "EASY WEB" / "NAVIGATION" (brand) above a smaller
//    "KEYBOARD ACCESS CHECK" descriptor, so the full store identity reads clearly
//    without cramming the hyphenated name onto one line.
{
  const W = 440;
  const H = 280;
  const GREY = [70, 78, 92];
  const buf = solidCanvas(W, H, WHITE);
  const iconSize = 168;
  const iconRgba = resizeRGBA(src.data, src.width, src.height, iconSize, iconSize);
  blit(buf, W, iconRgba, iconSize, iconSize, 26, Math.round((H - iconSize) / 2));
  const textCenterX = 26 + iconSize + 14 + (W - (26 + iconSize + 14) - 18) / 2;
  const cap = 28;
  const gap = 12;
  const subCap = 12;
  const subGap = 16;
  const totalTextH = cap * 2 + gap + subGap + subCap;
  const top1 = Math.round((H - totalTextH) / 2);
  drawText(buf, W, H, "EASY WEB", textCenterX, top1, cap, BLUE);
  drawText(buf, W, H, "NAVIGATION", textCenterX, top1 + cap + gap, cap, BLUE);
  drawText(
    buf,
    W,
    H,
    "KEYBOARD ACCESS CHECK",
    textCenterX,
    top1 + cap * 2 + gap + subGap,
    subCap,
    GREY,
  );
  writeFileSync(join(STORE, "chrome-small-promo-440x280.png"), encodePNG(W, H, buf));
  console.log("wrote chrome-small-promo-440x280.png");
}

console.log(`brand blue: rgb(${BLUE.join(", ")})`);
console.log("Store / GitHub brand assets regenerated from the official source.");
