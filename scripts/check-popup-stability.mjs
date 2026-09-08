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
 * How many resize rounds are acceptable.
 *
 * One is the browser sizing the popup for the first time. This rig allows a
 * small margin above that because `setViewportSize` sizes the OUTER window
 * (scrollbar included) while the browser's own popup sizing works in content
 * pixels, so a scrollbar appearing or disappearing can cost one extra settling
 * step. What must never happen is the size failing to settle, or the content
 * size tracking the popup size -- both checked separately below.
 *
 * For scale: before the sizing contract was introduced, the same three runs
 * took 31, 8 and 16 resizes and the content width equalled the popup width at
 * every step.
 */
const MAX_RESIZES = 3;

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
    /** Every size the popup took, in order, to detect oscillation. */
    const sizeTrail = [];
    const began = Date.now();

    while (Date.now() - began < SETTLE_MS) {
      let preferred;
      try {
        preferred = await page.evaluate(() => {
          // <body>, not <html>: the root element's scroll size is floored at the
          // viewport, so it can only ever report growth. The body's scroll size
          // is the document's real content size and can shrink, which is what
          // the browser's own preferred-size calculation does.
          const body = document.body;
          // Nothing is painted, and the browser measures nothing, until the
          // document has been parsed and its render-blocking stylesheet has
          // applied. Sampling before that reports the blank document, not the
          // popup.
          if (!body || document.readyState === "loading") return { pending: true };
          // `.popup` is the pre-contract root, so a build from before the fix
          // is measured the same way and the comparison stays like-for-like.
          const shell = document.querySelector(".shell, .popup");
          return {
            w: body.scrollWidth,
            h: body.scrollHeight,
            shellW: shell ? Math.round(shell.getBoundingClientRect().width) : 0,
            innerW: window.innerWidth,
          };
        });
      } catch {
        await new Promise((r) => setTimeout(r, TICK_MS));
        continue;
      }

      if (preferred.pending) {
        await new Promise((r) => setTimeout(r, TICK_MS));
        continue;
      }
      // The shell only exists once React has mounted; before that there is
      // nothing meaningful to compare against the popup width.
      if (preferred.shellW > 0) shellWidths.set(preferred.innerW, preferred.shellW);

      const nextW = Math.min(MAX_W, Math.max(MIN, preferred.w));
      const nextH = Math.min(MAX_H, Math.max(MIN, preferred.h));
      if (nextW !== w || nextH !== h) {
        resizes += 1;
        w = nextW;
        h = nextH;
        sizeTrail.push(`${w}x${h}`);
        await page.setViewportSize({ width: w, height: h }).catch(() => {});
      }
      await new Promise((r) => setTimeout(r, TICK_MS));
    }

    return {
      label: start.label,
      start,
      final: { w, h },
      resizes,
      sizeTrail,
      // A size the popup returns to after leaving it is the signature of the
      // original bug: the popup hunting between two layouts.
      oscillated: new Set(sizeTrail).size !== sizeTrail.length,
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

  if (shellSizes.length > 1) {
    // The bug itself: content size derived from the popup size.
    fail(
      `${line}\n      the shell rendered at ${JSON.stringify(shellSizes)} for different popup ` +
        `widths — a viewport-dependent length is back.`,
    );
  } else if (shellSizes.length === 0) {
    fail(`${line}\n      the popup shell never rendered, so nothing could be measured.`);
  } else if (run.oscillated) {
    fail(
      `${line}\n      the popup returned to a size it had already left: ${run.sizeTrail.join(" -> ")}`,
    );
  } else if (run.resizes > MAX_RESIZES) {
    fail(
      `${line}\n      popup resized ${run.resizes} times (${run.sizeTrail.join(" -> ")}); ` +
        `expected at most ${MAX_RESIZES}.`,
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
