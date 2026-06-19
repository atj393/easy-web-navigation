/**
 * Create store-ready release ZIPs for Easy Web Navigation.
 *
 * - Builds + zips the Chromium MV3 package via WXT (`wxt zip`).
 * - Copies it to versioned artifacts:
 *     artifacts/chrome/easy-web-navigation-chrome-v<version>.zip
 *     artifacts/edge/easy-web-navigation-edge-v<version>.zip
 *   (Edge uses the same Chromium MV3 package — Edge Add-ons accepts MV3.)
 * - Validates each ZIP has `manifest.json` at its ROOT (Chrome/Edge requirement)
 *   using a built-in central-directory parser (no external dependencies).
 * - Prints file sizes.
 *
 * It does NOT upload anything. Manual store submission stays with the user.
 *
 *   node scripts/create-store-zips.mjs            # build + package chrome & edge
 *   node scripts/create-store-zips.mjs --inspect  # validate existing artifacts only
 */
import { execSync } from "node:child_process";
import {
  readFileSync,
  mkdirSync,
  copyFileSync,
  rmSync,
  existsSync,
  readdirSync,
  statSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EXT = join(ROOT, "apps", "extension");
const OUTPUT = join(EXT, ".output");
const ARTIFACTS = join(ROOT, "artifacts");
const inspectOnly = process.argv.includes("--inspect");

const version = JSON.parse(readFileSync(join(EXT, "package.json"), "utf8")).version;

/** List entry names from a ZIP via its central directory (pure Node). */
function listZipEntries(zipPath) {
  const buf = readFileSync(zipPath);
  const EOCD_SIG = 0x06054b50;
  const CDH_SIG = 0x02014b50;
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error(`Could not read ZIP central directory: ${zipPath}`);
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const names = [];
  for (let n = 0; n < count && off + 46 <= buf.length; n++) {
    if (buf.readUInt32LE(off) !== CDH_SIG) break;
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    names.push(buf.toString("utf8", off + 46, off + 46 + nameLen));
    off += 46 + nameLen + extraLen + commentLen;
  }
  return names;
}

function validateZip(label, zipPath) {
  if (!existsSync(zipPath)) throw new Error(`${label}: ZIP not found at ${zipPath}`);
  const entries = listZipEntries(zipPath);
  const hasRootManifest = entries.includes("manifest.json");
  const sizeKb = (statSync(zipPath).size / 1024).toFixed(1);
  console.log(`\n${label}`);
  console.log(`  path: ${zipPath}`);
  console.log(`  size: ${sizeKb} kB`);
  console.log(`  entries: ${entries.length}`);
  console.log(`  manifest.json at root: ${hasRootManifest ? "YES ✓" : "NO ✗"}`);
  if (!hasRootManifest) throw new Error(`${label}: manifest.json is not at the ZIP root`);
  return { sizeKb, entries: entries.length };
}

function findWxtChromeZip() {
  const matches = readdirSync(OUTPUT).filter((f) => f.endsWith("-chrome.zip"));
  if (matches.length === 0) throw new Error("WXT did not produce a *-chrome.zip in .output");
  // Newest by mtime.
  matches.sort((a, b) => statSync(join(OUTPUT, b)).mtimeMs - statSync(join(OUTPUT, a)).mtimeMs);
  return join(OUTPUT, matches[0]);
}

const chromeArtifact = join(ARTIFACTS, "chrome", `easy-web-navigation-chrome-v${version}.zip`);
const edgeArtifact = join(ARTIFACTS, "edge", `easy-web-navigation-edge-v${version}.zip`);

if (!inspectOnly) {
  console.log(`Building + zipping Chromium MV3 package (v${version})…`);
  // Clean previous artifacts for a deterministic result.
  rmSync(ARTIFACTS, { recursive: true, force: true });
  mkdirSync(join(ARTIFACTS, "chrome"), { recursive: true });
  mkdirSync(join(ARTIFACTS, "edge"), { recursive: true });

  execSync("pnpm -C apps/extension zip", { cwd: ROOT, stdio: "inherit" });

  const wxtZip = findWxtChromeZip();
  copyFileSync(wxtZip, chromeArtifact);
  // Edge Add-ons accepts the same Chromium MV3 package.
  copyFileSync(wxtZip, edgeArtifact);
}

console.log("\nValidating store ZIPs (manifest.json must be at the ZIP root):");
validateZip("Chrome  (Chrome Web Store)", chromeArtifact);
validateZip("Edge    (Microsoft Edge Add-ons — Chromium MV3)", edgeArtifact);
console.log("\nDone. ZIPs are ready for MANUAL upload. Nothing was uploaded.");
