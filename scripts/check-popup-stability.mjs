#!/usr/bin/env node
/**
 * RB-001 real-browser verification.
 *
 * Loads the built Chromium MV3 extension into a real browser and emulates the
 * popup autosizer: the browser repeatedly reads the document's preferred size
 * and resizes the popup window to match (clamped to 800x600). If any popup
 * length depends on the viewport, that loop never settles on the first frame
 * and the user watches the popup grow or jump while it opens.
 *
 * The check passes when, from several plausible starting sizes, the popup
 * reaches its final size within ONE resize and the rendered shell width is the
 * same regardless of the popup width (i.e. content size does not depend on
 * viewport size).
 *
 * Usage:
 *   pnpm build
 *   node scripts/check-popup-stability.mjs [--json] [--extension <dir>]
 *
 * Requires `playwright-core` and a Chromium binary. Both are optional: when
 * they are missing the script exits 0 with a SKIPPED notice, so it can be wired
 * into CI without making the pipeline depend on a browser download.
 */
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const extIndex = args.indexOf("--extension");
const EXTENSION_DIR = path.resolve(
  extIndex >= 0 && args[extIndex + 1] ? args[extIndex + 1] : "apps/extension/.output/chrome-mv3",
);

/** Chromium clamps extension popups to this box. */
const MAX_W = 800;
const MAX_H = 600;
const MIN = 25;
const TICK_MS = 16;
const SETTLE_MS = 1200;

/** Starting popup sizes the browser might pick before the first measurement. */
const START_SIZES = [
  { w: 100, h: 100, label: "cold start (small)" },
  { w: 420, h: 500, label: "remembered size" },
  { w: 360, h: 620, label: "narrow and tall" },
];

/**
 * How many resize rounds are acceptable. One is the browser sizing the popup
 * for the first time; anything beyond that is the popup changing size in front
 * of the user.
 */
const MAX_RESIZES = 1;

function fail(message) {
  console.error(`FAIL  ${message}`);
  process.exitCode = 1;
}

function skip(message) {
  console.log(`SKIP  ${message}`);
  process.exit(0);
}

let chromium;
try {
  ({ chromium } = await import("playwright-core"));
} catch {
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    skip("playwright-core is not installed; run `npm i -D playwright-core` to enable this check.");
  }
}

const EXECUTABLE = [
  process.env.CHROMIUM_PATH,
  "/opt/pw-browsers/chromium",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
].find((p) => p && existsSync(p));

if (!existsSync(path.join(EXTENSION_DIR, "manifest.json"))) {
  skip(`no build at ${EXTENSION_DIR}; run \`pnpm build\` first.`);
}

/** Measure one popup-open sequence from a given starting size. */
async function measure(start) {
  const userDataDir = mkdtempSync(path.join(tmpdir(), "ewn-popup-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    ...(EXECUTABLE ? { executablePath: EXECUTABLE } : {}),
    headless: true,
    args: [
      `--disable-extensions-except=${EXTENSION_DIR}`,
      `--load-extension=${EXTENSION_DIR}`,
      "--no-sandbox",
    ],
    viewport: { width: start.w, height: start.h },
  });

  try {
    let worker = context.serviceWorkers()[0];
    if (!worker) worker = await context.waitForEvent("serviceworker", { timeout: 15_000 });
    const extensionId = new URL(worker.url()).host;

    const page = await context.newPage();
    await page.setViewportSize({ width: start.w, height: start.h });
    await page
      .goto(`chrome-extension://${extensionId}/popup.html`, { waitUntil: "commit" })
      .catch(() => {});

    let w = start.w;
    let h = start.h;
    let resizes = 0;
    /** popup width -> rendered shell width, to prove independence. */
    const shellWidths = new Map();
    const began = Date.now();

    while (Date.now() - began < SETTLE_MS) {
      let preferred;
      try {
        preferred = await page.evaluate(() => {
          const de = document.documentElement;
          const body = document.body;
          const shell = document.querySelector(".shell") ?? document.getElementById("root");
          return {
            w: Math.max(de ? de.scrollWidth : 0, body ? body.scrollWidth : 0),
            h: Math.max(de ? de.scrollHeight : 0, body ? body.scrollHeight : 0),
            shellW: shell ? Math.round(shell.getBoundingClientRect().width) : 0,
            innerW: window.innerWidth,
          };
        });
      } catch {
        await new Promise((r) => setTimeout(r, TICK_MS));
        continue;
      }

      // Ignore the pre-render frame, where the shell has not been mounted yet.
      if (preferred.shellW > 0) shellWidths.set(preferred.innerW, preferred.shellW);

      const nextW = Math.min(MAX_W, Math.max(MIN, preferred.w));
      const nextH = Math.min(MAX_H, Math.max(MIN, preferred.h));
      if (nextW !== w || nextH !== h) {
        resizes += 1;
        w = nextW;
        h = nextH;
        await page.setViewportSize({ width: w, height: h }).catch(() => {});
      }
      await new Promise((r) => setTimeout(r, TICK_MS));
    }

    return {
      label: start.label,
      start,
      final: { w, h },
      resizes,
      shellWidths: [...shellWidths.entries()].map(([popupW, shellW]) => ({ popupW, shellW })),
    };
  } finally {
    await context.close().catch(() => {});
    rmSync(userDataDir, { recursive: true, force: true });
  }
}

const runs = [];
for (const start of START_SIZES) {
  runs.push(await measure(start));
}

if (asJson) {
  console.log(JSON.stringify({ extension: EXTENSION_DIR, runs }, null, 2));
}

for (const run of runs) {
  const shellSizes = [...new Set(run.shellWidths.map((s) => s.shellW))];
  const line =
    `${run.label.padEnd(20)} ${run.start.w}x${run.start.h} -> ` +
    `${run.final.w}x${run.final.h}  resizes=${run.resizes}  shell widths=${JSON.stringify(shellSizes)}`;

  if (run.resizes > MAX_RESIZES) {
    fail(`${line}\n      popup resized ${run.resizes} times; expected at most ${MAX_RESIZES}.`);
  } else if (shellSizes.length > 1) {
    fail(
      `${line}\n      shell width tracks the popup width — a viewport-dependent length is back.`,
    );
  } else {
    console.log(`PASS  ${line}`);
  }
}

if (process.exitCode) {
  console.error("\nRB-001 regression: see the popup sizing contract at the top of");
  console.error("apps/extension/entrypoints/popup/style.css.");
} else {
  console.log("\nPopup opens at a stable size from every starting point.");
}
