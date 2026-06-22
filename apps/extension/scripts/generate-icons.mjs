/**
 * Generate the Easy Web Navigation runtime toolbar icons (16/32/48/128) by
 * downscaling the OFFICIAL brand source, using only Node built-ins (no external
 * dependencies, no network).
 *
 * Source of truth (canonical, user-provided original artwork):
 *   assets/brand/easy-web-navigation-icon-source.png
 *
 * This script reads that source and writes crisp PNG size variants into
 * `public/`. It can NOT synthesise or restore any older generated artwork — the
 * official icon is the only input. The PNGs are committed, so contributors
 * never need to run this. Re-run with:
 *   node scripts/generate-icons.mjs   (from apps/extension)  — or  pnpm icons
 */
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { decodePNG, encodePNG, resizeRGBA } from "../../../scripts/lib/png.mjs";

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = join(PKG_ROOT, "..", "..");
const SOURCE = join(REPO_ROOT, "assets", "brand", "easy-web-navigation-icon-source.png");
const OUT = join(PKG_ROOT, "public");
const SIZES = [16, 32, 48, 128];

const src = decodePNG(readFileSync(SOURCE));
console.log(`source: ${SOURCE} (${src.width}×${src.height})`);

mkdirSync(OUT, { recursive: true });
for (const size of SIZES) {
  const rgba = resizeRGBA(src.data, src.width, src.height, size, size);
  writeFileSync(join(OUT, `icon-${size}.png`), encodePNG(size, size, rgba));
  console.log(`wrote icon-${size}.png`);
}
console.log("Runtime icons regenerated from the official brand source.");
