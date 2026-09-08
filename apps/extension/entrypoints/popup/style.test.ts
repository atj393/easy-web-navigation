/**
 * RB-001 regression guard — the popup sizing contract.
 *
 * A browser extension popup is auto-sized: the browser repeatedly reads the
 * document's preferred size and resizes the popup window to match. Any CSS
 * length derived from the viewport therefore feeds the popup's own size back
 * into its content size, and the browser walks that loop one step per frame.
 * That is exactly what produced the "popup grows and jumps while opening" bug:
 * `width: min(420px, calc(100vw - 32px))` on a `content-box` element made the
 * content width a function of the popup width, and the popup width a function
 * of the content width.
 *
 * These assertions are deliberately about the stylesheet rather than a rendered
 * screenshot: they are cheap, they run in normal CI, and they fail loudly if
 * anyone reintroduces the shape of the bug. Real-browser verification lives in
 * `scripts/check-popup-stability.mjs`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Resolved from the workspace root (Vitest's cwd) rather than import.meta.url,
// which the jsdom environment serves over http:.
const css = readFileSync(
  resolve(process.cwd(), "apps/extension/entrypoints/popup/style.css"),
  "utf8",
);

/** Strip comments so prose about viewport units is not mistaken for CSS. */
const declarations = css.replace(/\/\*[\s\S]*?\*\//g, "");

describe("popup sizing contract (RB-001)", () => {
  it("uses no viewport-relative units anywhere", () => {
    // vw/vh/vmin/vmax/svh/lvh/dvh — any of them reintroduces the resize loop.
    const viewportUnits = declarations.match(/\b\d*\.?\d+(vw|vh|vmin|vmax|svh|lvh|dvh|svw|dvw)\b/g);
    expect(viewportUnits).toBeNull();
  });

  it("pins an explicit pixel width on html, body and the shell", () => {
    expect(declarations).toMatch(/--popup-width:\s*\d+px/);
    expect(declarations).toMatch(/html,\s*\n?body\s*\{[^}]*width:\s*var\(--popup-width\)/);
    expect(declarations).toMatch(/\.shell\s*\{[^}]*width:\s*var\(--popup-width\)/);
  });

  it("gives the shell a fixed height so hydration cannot change the popup", () => {
    expect(declarations).toMatch(/--popup-height:\s*\d+px/);
    expect(declarations).toMatch(/\.shell\s*\{[^}]*height:\s*var\(--popup-height\)/);
  });

  it("sizes the document itself, so the empty first frame is already final", () => {
    // Otherwise the browser sizes the popup once for the pre-React document and
    // again for the mounted shell — a visible jump on a cold start.
    expect(declarations).toMatch(/html,\s*\n?body\s*\{[^}]*height:\s*var\(--popup-height\)/);
  });

  it("stays inside the browser popup limits (800x600 in Chromium)", () => {
    const width = Number(/--popup-width:\s*(\d+)px/.exec(declarations)?.[1]);
    const height = Number(/--popup-height:\s*(\d+)px/.exec(declarations)?.[1]);
    expect(width).toBeGreaterThan(0);
    expect(width).toBeLessThanOrEqual(800);
    expect(height).toBeGreaterThan(0);
    expect(height).toBeLessThanOrEqual(600);
  });

  it("applies border-box globally so padding cannot widen the shell", () => {
    expect(declarations).toMatch(
      /\*,\s*\n?\*::before,\s*\n?\*::after\s*\{[^}]*box-sizing:\s*border-box/,
    );
  });

  it("scrolls variable content inside the shell, not the popup window", () => {
    expect(declarations).toMatch(/\.shell__body\s*\{[^}]*overflow-y:\s*auto/);
    expect(declarations).toMatch(/\.shell__body\s*\{[^}]*flex:\s*1 1 auto/);
  });

  it("reserves a fixed-height status strip so messages never move controls", () => {
    expect(declarations).toMatch(/\.header__status\s*\{[^}]*min-height:\s*\d+px/);
  });

  it("does not clip the outer document, so high zoom stays reachable", () => {
    // At 200% zoom the popup is clamped to 800x600 while the document keeps its
    // CSS-pixel size; the outer document must be able to scroll.
    expect(declarations).not.toMatch(/html,\s*\n?body\s*\{[^}]*overflow:\s*hidden/);
  });
});

describe("popup theming contract", () => {
  it("declares a light palette and a dark override for every colour token", () => {
    const root = /:root\s*\{([\s\S]*?)\}/.exec(declarations)?.[1] ?? "";
    const dark =
      /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{([\s\S]*?)\}/.exec(
        declarations,
      )?.[1] ?? "";
    const colourTokens = [
      ...root.matchAll(/(--(?:bg|fg|border|primary|focus|danger|warning|ok|sev)[\w-]*):/g),
    ].map((m) => m[1]);
    expect(colourTokens.length).toBeGreaterThan(10);
    const missing = colourTokens.filter((token) => !dark.includes(`${token}:`));
    expect(missing).toEqual([]);
  });

  it("supports Windows high contrast", () => {
    expect(declarations).toMatch(/@media\s*\(forced-colors:\s*active\)/);
  });
});
