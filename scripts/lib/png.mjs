/**
 * Minimal, dependency-free PNG codec for build-time brand-asset generation.
 *
 * Supports the cases this repo needs: 8-bit, non-interlaced PNGs in grayscale,
 * grayscale+alpha, RGB, or RGBA. Decodes to a flat RGBA buffer, area-averages
 * (box-filter) downscales, and re-encodes as RGBA. Pure Node built-ins only —
 * no external dependencies and no network. Used to produce the runtime icons
 * and store assets from the canonical brand source in `assets/brand/`.
 */
import zlib from "node:zlib";

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/** Decode an 8-bit, non-interlaced PNG into { width, height, data: RGBA }. */
export function decodePNG(buf) {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(SIGNATURE)) {
    throw new Error("Not a PNG file");
  }
  let off = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat = [];

  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const dataStart = off + 8;
    const data = buf.subarray(dataStart, dataStart + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "IDAT") {
      idat.push(Buffer.from(data));
    } else if (type === "IEND") {
      break;
    }
    off = dataStart + len + 4; // data + 4-byte CRC
  }

  if (bitDepth !== 8) throw new Error(`Unsupported PNG bit depth: ${bitDepth} (need 8)`);
  if (interlace !== 0) throw new Error("Interlaced PNGs are not supported");
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`Unsupported PNG color type: ${colorType}`);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = channels;
  const stride = width * bpp;
  const line = Buffer.alloc(stride);
  const prev = Buffer.alloc(stride);
  const out = Buffer.alloc(width * height * 4);
  let pos = 0;

  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    for (let x = 0; x < stride; x++) {
      const rawByte = raw[pos++];
      const a = x >= bpp ? line[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let val;
      switch (filter) {
        case 0:
          val = rawByte;
          break;
        case 1:
          val = rawByte + a;
          break;
        case 2:
          val = rawByte + b;
          break;
        case 3:
          val = rawByte + ((a + b) >> 1);
          break;
        case 4:
          val = rawByte + paeth(a, b, c);
          break;
        default:
          throw new Error(`Unsupported PNG filter type: ${filter}`);
      }
      line[x] = val & 0xff;
    }
    for (let px = 0; px < width; px++) {
      const si = px * bpp;
      const di = (y * width + px) * 4;
      if (channels === 3) {
        out[di] = line[si];
        out[di + 1] = line[si + 1];
        out[di + 2] = line[si + 2];
        out[di + 3] = 255;
      } else if (channels === 4) {
        out[di] = line[si];
        out[di + 1] = line[si + 1];
        out[di + 2] = line[si + 2];
        out[di + 3] = line[si + 3];
      } else if (channels === 1) {
        out[di] = out[di + 1] = out[di + 2] = line[si];
        out[di + 3] = 255;
      } else {
        out[di] = out[di + 1] = out[di + 2] = line[si];
        out[di + 3] = line[si + 1];
      }
    }
    line.copy(prev);
  }

  return { width, height, data: out };
}

// --- PNG encoder (RGBA, 8-bit) -------------------------------------------
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

/** Encode a flat RGBA buffer as an 8-bit RGBA PNG. */
export function encodePNG(width, height, rgba) {
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
    Buffer.from(SIGNATURE),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * Area-average (box-filter) resize of an RGBA buffer. Alpha-aware: colors are
 * averaged weighted by alpha so transparent edges do not darken. Produces crisp
 * results for large downscales (the brand source is 3200×3200).
 */
export function resizeRGBA(src, sw, sh, dw, dh) {
  const out = Buffer.alloc(dw * dh * 4);
  for (let dy = 0; dy < dh; dy++) {
    const sy0 = Math.floor((dy * sh) / dh);
    const sy1 = Math.max(sy0 + 1, Math.floor(((dy + 1) * sh) / dh));
    for (let dx = 0; dx < dw; dx++) {
      const sx0 = Math.floor((dx * sw) / dw);
      const sx1 = Math.max(sx0 + 1, Math.floor(((dx + 1) * sw) / dw));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const si = (sy * sw + sx) * 4;
          const al = src[si + 3];
          r += src[si] * al;
          g += src[si + 1] * al;
          b += src[si + 2] * al;
          a += al;
          n += 1;
        }
      }
      const di = (dy * dw + dx) * 4;
      if (a > 0) {
        out[di] = Math.round(r / a);
        out[di + 1] = Math.round(g / a);
        out[di + 2] = Math.round(b / a);
        out[di + 3] = Math.round(a / n);
      } else {
        out[di] = out[di + 1] = out[di + 2] = 0;
        out[di + 3] = 0;
      }
    }
  }
  return out;
}
