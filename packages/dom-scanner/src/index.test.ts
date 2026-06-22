import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { ScanResult } from "@easy-web-navigation/shared-types";
import {
  scanDocument,
  getStableSelector,
  getElementPreview,
  collectFocusableElements,
  createScanContext,
  isVisuallyAvailableForKeyboardPath,
  hasMeaningfulSize,
  isFullyOffCanvasHorizontally,
  isClippedAwayBy,
  PROFILE,
} from "./index";

/** Run a deterministic scan of the current jsdom document. */
function scan(): ScanResult {
  return scanDocument(document, {}, () => 0);
}

function issuesFor(result: ScanResult, ruleId: string) {
  return result.issues.filter((i) => i.ruleId === ruleId);
}

beforeEach(() => {
  document.title = "Test Page";
  document.body.innerHTML = "";
});

describe("getStableSelector", () => {
  it("prefers a unique id", () => {
    document.body.innerHTML = `<div><button id="save">Save</button></div>`;
    const el = document.getElementById("save")!;
    expect(getStableSelector(el)).toBe("#save");
  });

  it("falls back to a tag + nth-of-type path", () => {
    document.body.innerHTML = `<div class="wrap"><p>one</p><p>two</p></div>`;
    const second = document.querySelectorAll("p")[1];
    expect(getStableSelector(second)).toContain("p:nth-of-type(2)");
  });

  it("uses a useful attribute when unique", () => {
    document.body.innerHTML = `<input name="email" type="text" />`;
    const el = document.querySelector("input")!;
    expect(getStableSelector(el)).toBe('input[name="email"]');
  });

  it("returns an empty string for null", () => {
    expect(getStableSelector(null)).toBe("");
  });
});

describe("getElementPreview", () => {
  it("renders a short HTML-ish preview with text", () => {
    document.body.innerHTML = `<button class="x" type="button">Click me</button>`;
    const el = document.querySelector("button")!;
    const preview = getElementPreview(el);
    expect(preview).toContain("<button");
    expect(preview).toContain("Click me");
    expect(preview.length).toBeLessThanOrEqual(140);
  });

  it("renders void elements without a closing tag", () => {
    document.body.innerHTML = `<input type="text" name="q" />`;
    const el = document.querySelector("input")!;
    const preview = getElementPreview(el);
    expect(preview.startsWith("<input")).toBe(true);
    expect(preview).not.toContain("</input>");
  });

  it("returns (none) for null", () => {
    expect(getElementPreview(null)).toBe("(none)");
  });
});

describe("collectFocusableElements", () => {
  it("includes visible, enabled, focusable elements and excludes the rest", () => {
    document.body.innerHTML = `
      <a href="#">link</a>
      <button>b</button>
      <input type="text" />
      <input type="hidden" />
      <button disabled>d</button>
      <span tabindex="0">s</span>
      <span tabindex="-1">s</span>
      <button hidden>h</button>
      <div>plain</div>
    `;
    const ctx = createScanContext(document);
    const focusable = collectFocusableElements(ctx);
    // a + button + input[text] + span[tabindex=0]
    expect(focusable.length).toBe(4);
  });
});

describe("scanDocument", () => {
  it("returns a structured, non-placeholder result", () => {
    document.body.innerHTML = `<main><button>Ok</button></main>`;
    const result = scan();
    expect(result.profile).toBe(PROFILE);
    expect(result.title).toBe("Test Page");
    expect(result.scannedAt).toBe(0);
    expect(typeof result.summary.total).toBe("number");
    expect(result).not.toHaveProperty("placeholder");
  });

  it("produces issues for a page full of problems", () => {
    document.body.innerHTML = `
      <header><nav><a href="#a">Home</a></nav></header>
      <div role="button">Open</div>
      <button></button>
      <input type="text" id="email" />
      <a href="#" tabindex="3">Jump</a>
    `;
    const result = scan();
    expect(result.summary.total).toBeGreaterThan(0);
    expect(issuesFor(result, "missing-main-landmark").length).toBe(1);
    expect(issuesFor(result, "clickable-not-focusable").length).toBe(1);
    expect(issuesFor(result, "unlabeled-control").length).toBeGreaterThanOrEqual(1);
    expect(issuesFor(result, "unlabeled-form-input").length).toBe(1);
    expect(issuesFor(result, "positive-tabindex").length).toBe(1);
    // Every issue carries the full contract.
    for (const issue of result.issues) {
      expect(issue.id).toBeTruthy();
      expect(issue.wcag.length).toBeGreaterThan(0);
      expect(issue.recommendation.length).toBeGreaterThan(0);
      expect(issue.canAutoEnhance).toBe(false);
    }
  });
});

describe("rule: clickable-not-focusable", () => {
  it("flags an interactive-role element that is not focusable", () => {
    document.body.innerHTML = `<main><div role="button">Go</div></main>`;
    expect(issuesFor(scan(), "clickable-not-focusable").length).toBe(1);
  });

  it("does not flag the same element when it is focusable", () => {
    document.body.innerHTML = `<main><div role="button" tabindex="0">Go</div></main>`;
    expect(issuesFor(scan(), "clickable-not-focusable").length).toBe(0);
  });

  it("does not flag native buttons", () => {
    document.body.innerHTML = `<main><button onclick="x()">Go</button></main>`;
    expect(issuesFor(scan(), "clickable-not-focusable").length).toBe(0);
  });
});

describe("rule: unlabeled-form-input", () => {
  it("flags an input with no label (serious)", () => {
    document.body.innerHTML = `<main><input type="text" /></main>`;
    const issues = issuesFor(scan(), "unlabeled-form-input");
    expect(issues.length).toBe(1);
    expect(issues[0].severity).toBe("serious");
  });

  it("downgrades to moderate when only a placeholder is present", () => {
    document.body.innerHTML = `<main><input type="text" placeholder="Name" /></main>`;
    const issues = issuesFor(scan(), "unlabeled-form-input");
    expect(issues.length).toBe(1);
    expect(issues[0].severity).toBe("moderate");
  });

  it("does not flag a wrapped or associated label", () => {
    document.body.innerHTML = `
      <main>
        <label>Name <input type="text" /></label>
        <label for="e">Email</label><input id="e" type="text" />
      </main>`;
    expect(issuesFor(scan(), "unlabeled-form-input").length).toBe(0);
  });

  it("ignores hidden inputs", () => {
    document.body.innerHTML = `<main><input type="hidden" /></main>`;
    expect(issuesFor(scan(), "unlabeled-form-input").length).toBe(0);
  });

  it("honors aria-labelledby", () => {
    document.body.innerHTML = `<main><span id="l">Email</span><input type="text" aria-labelledby="l" /></main>`;
    expect(issuesFor(scan(), "unlabeled-form-input").length).toBe(0);
  });
});

describe("rule: positive-tabindex", () => {
  it("flags tabindex greater than zero only", () => {
    document.body.innerHTML = `
      <main>
        <div tabindex="3">a</div>
        <div tabindex="0">b</div>
        <div tabindex="-1">c</div>
      </main>`;
    expect(issuesFor(scan(), "positive-tabindex").length).toBe(1);
  });
});

describe("rule: missing-main-landmark", () => {
  it("flags a page with no main", () => {
    document.body.innerHTML = `<div>content</div>`;
    expect(issuesFor(scan(), "missing-main-landmark").length).toBe(1);
  });

  it("does not flag a page with a main landmark", () => {
    document.body.innerHTML = `<main>content</main>`;
    expect(issuesFor(scan(), "missing-main-landmark").length).toBe(0);
  });

  it("accepts role=main", () => {
    document.body.innerHTML = `<div role="main">content</div>`;
    expect(issuesFor(scan(), "missing-main-landmark").length).toBe(0);
  });
});

describe("rule: missing-skip-link", () => {
  it("flags nav/header content with no skip link", () => {
    document.body.innerHTML = `<header><nav><a href="#x">Home</a></nav></header><div>body</div>`;
    expect(issuesFor(scan(), "missing-skip-link").length).toBe(1);
  });

  it("does not flag when a skip link by text exists", () => {
    document.body.innerHTML = `<a href="#c">Skip to content</a><header><nav><a href="#x">Home</a></nav></header>`;
    expect(issuesFor(scan(), "missing-skip-link").length).toBe(0);
  });

  it("does not flag when there is no nav/header to bypass", () => {
    document.body.innerHTML = `<div>just content</div>`;
    expect(issuesFor(scan(), "missing-skip-link").length).toBe(0);
  });
});

describe("rule: unlabeled-control", () => {
  it("flags an empty button and an empty link", () => {
    document.body.innerHTML = `<main><button></button><a href="#"></a></main>`;
    expect(issuesFor(scan(), "unlabeled-control").length).toBe(2);
  });

  it("does not flag controls with text or aria-label", () => {
    document.body.innerHTML = `<main><button>Save</button><a href="#" aria-label="Home"></a></main>`;
    expect(issuesFor(scan(), "unlabeled-control").length).toBe(0);
  });

  it("uses nested image alt text as an accessible name", () => {
    document.body.innerHTML = `<main><button><img alt="Search" /></button></main>`;
    expect(issuesFor(scan(), "unlabeled-control").length).toBe(0);
  });
});

describe("open shadow DOM traversal", () => {
  it("finds issues inside an open shadow root", () => {
    document.body.innerHTML = `<main><div id="host"></div></main>`;
    const host = document.getElementById("host")!;
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `<button></button>`;
    expect(issuesFor(scan(), "unlabeled-control").length).toBe(1);
  });
});

/* ---- Keyboard-path visual availability -------------------------------- */

/** A DOMRect-like value for stubbing layout in jsdom (which has none). */
function vrect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON() {
      return this;
    },
  } as DOMRect;
}

/** Make `isLayoutAvailable` report true (jsdom returns zeros for everything). */
function enableLayout(): void {
  (
    document.documentElement as unknown as { getBoundingClientRect: () => DOMRect }
  ).getBoundingClientRect = () => vrect(0, 0, 1024, 768);
}

/** Give an element a fixed rendered rectangle + matching client rects. */
function stubRect(el: Element, r: DOMRect): void {
  (el as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect = () => r;
  (el as unknown as { getClientRects: () => DOMRect[] }).getClientRects = () =>
    r.width > 0 || r.height > 0 ? [r] : [];
}

afterEach(() => {
  // Drop any per-test layout stub so other suites see jsdom defaults again.
  delete (document.documentElement as unknown as { getBoundingClientRect?: unknown })
    .getBoundingClientRect;
});

describe("keyboard-path geometry helpers (pure, mocked rectangles)", () => {
  it("hasMeaningfulSize requires >= 1px on both axes", () => {
    expect(
      hasMeaningfulSize({ left: 0, right: 10, top: 0, bottom: 10, width: 10, height: 10 }),
    ).toBe(true);
    expect(hasMeaningfulSize({ left: 0, right: 0, top: 0, bottom: 10, width: 0, height: 10 })).toBe(
      false,
    );
    expect(hasMeaningfulSize({ left: 0, right: 10, top: 0, bottom: 0, width: 10, height: 0 })).toBe(
      false,
    );
  });

  it("isFullyOffCanvasHorizontally flags drawers translated off either side", () => {
    const vw = 1000;
    // translated fully left (right <= 0)
    expect(
      isFullyOffCanvasHorizontally(
        { left: -300, right: -20, top: 0, bottom: 40, width: 280, height: 40 },
        vw,
      ),
    ).toBe(true);
    // translated fully right (left >= viewport width)
    expect(
      isFullyOffCanvasHorizontally(
        { left: 1000, right: 1280, top: 0, bottom: 40, width: 280, height: 40 },
        vw,
      ),
    ).toBe(true);
    // partially visible → kept
    expect(
      isFullyOffCanvasHorizontally(
        { left: -50, right: 230, top: 0, bottom: 40, width: 280, height: 40 },
        vw,
      ),
    ).toBe(false);
    // below the fold but on-canvas → kept (vertical is never an off-canvas reason)
    expect(
      isFullyOffCanvasHorizontally(
        { left: 10, right: 290, top: 5000, bottom: 5040, width: 280, height: 40 },
        vw,
      ),
    ).toBe(false);
    // unknown viewport width → never excludes
    expect(
      isFullyOffCanvasHorizontally(
        { left: -300, right: -20, top: 0, bottom: 40, width: 280, height: 40 },
        0,
      ),
    ).toBe(false);
  });

  it("isClippedAwayBy respects the clipped axis and keeps partial overlap", () => {
    const clip = { left: 0, right: 200, top: 0, bottom: 200, width: 200, height: 200 };
    const right = { left: 300, right: 480, top: 10, bottom: 50, width: 180, height: 40 };
    const below = { left: 10, right: 190, top: 300, bottom: 340, width: 180, height: 40 };
    const overlap = { left: 150, right: 330, top: 10, bottom: 50, width: 180, height: 40 };
    expect(isClippedAwayBy(right, clip, true, false)).toBe(true); // x-clipped, fully right
    expect(isClippedAwayBy(below, clip, false, true)).toBe(true); // y-clipped, fully below
    expect(isClippedAwayBy(right, clip, false, true)).toBe(false); // ancestor doesn't clip x
    expect(isClippedAwayBy(overlap, clip, true, false)).toBe(false); // partial overlap kept
  });
});

describe("isVisuallyAvailableForKeyboardPath (DOM/style signals, no layout)", () => {
  const ctx = () => createScanContext(document);
  const el = (id: string) => document.getElementById(id)!;

  it("includes a normal visible control", () => {
    document.body.innerHTML = `<button id="b">Save</button>`;
    expect(isVisuallyAvailableForKeyboardPath(ctx(), el("b"))).toBe(true);
  });

  it("excludes hidden and display:none controls", () => {
    document.body.innerHTML = `<button id="h" hidden>x</button><button id="d" style="display:none">y</button>`;
    expect(isVisuallyAvailableForKeyboardPath(ctx(), el("h"))).toBe(false);
    expect(isVisuallyAvailableForKeyboardPath(ctx(), el("d"))).toBe(false);
  });

  it("excludes a descendant of a hidden ancestor", () => {
    document.body.innerHTML = `<div hidden><button id="c">x</button></div>`;
    expect(isVisuallyAvailableForKeyboardPath(ctx(), el("c"))).toBe(false);
  });

  it("excludes a control inside an inert subtree", () => {
    document.body.innerHTML = `<div inert><button id="c">x</button></div>`;
    expect(isVisuallyAvailableForKeyboardPath(ctx(), el("c"))).toBe(false);
  });

  it("excludes a control under content-visibility: hidden", () => {
    document.body.innerHTML = `<div style="content-visibility:hidden"><button id="c">x</button></div>`;
    expect(isVisuallyAvailableForKeyboardPath(ctx(), el("c"))).toBe(false);
  });

  it("does NOT exclude a control only because of opacity: 0", () => {
    document.body.innerHTML = `<button id="b" style="opacity:0">x</button>`;
    expect(isVisuallyAvailableForKeyboardPath(ctx(), el("b"))).toBe(true);
  });
});

describe("isVisuallyAvailableForKeyboardPath (layout/geometry signals)", () => {
  const ctx = () => createScanContext(document);

  it("excludes controls inside a width:0 overflow:hidden collapsed sidebar", () => {
    enableLayout();
    document.body.innerHTML = `<div id="side" style="overflow:hidden"><button id="b">menu</button></div>`;
    stubRect(document.getElementById("side")!, vrect(0, 0, 0, 600)); // collapsed to 0 width
    const b = document.getElementById("b")!;
    stubRect(b, vrect(0, 10, 240, 40)); // child overflows the 0-width parent
    expect(isVisuallyAvailableForKeyboardPath(ctx(), b)).toBe(false);
  });

  it("excludes controls in a drawer translated fully off-canvas", () => {
    enableLayout();
    document.body.innerHTML = `<div id="drawer"><button id="b">menu</button></div>`;
    const b = document.getElementById("b")!;
    stubRect(b, vrect(-320, 10, 280, 40)); // translateX(-100%): right = -40
    expect(isVisuallyAvailableForKeyboardPath(ctx(), b)).toBe(false);
  });

  it("keeps a partially visible control", () => {
    enableLayout();
    document.body.innerHTML = `<button id="b">x</button>`;
    const b = document.getElementById("b")!;
    stubRect(b, vrect(-30, 10, 280, 40)); // left edge clipped, most still visible
    expect(isVisuallyAvailableForKeyboardPath(ctx(), b)).toBe(true);
  });

  it("keeps a normal control far BELOW the viewport (long page)", () => {
    enableLayout();
    document.body.innerHTML = `<button id="b">x</button>`;
    const b = document.getElementById("b")!;
    stubRect(b, vrect(20, 9000, 200, 40));
    expect(isVisuallyAvailableForKeyboardPath(ctx(), b)).toBe(true);
  });

  it("keeps a normal control ABOVE the viewport", () => {
    enableLayout();
    document.body.innerHTML = `<button id="b">x</button>`;
    const b = document.getElementById("b")!;
    stubRect(b, vrect(20, -500, 200, 40));
    expect(isVisuallyAvailableForKeyboardPath(ctx(), b)).toBe(true);
  });

  it("does not exclude everything when layout is unavailable (jsdom fallback)", () => {
    // No enableLayout() here: isLayoutAvailable is false, so geometry is skipped.
    document.body.innerHTML = `<button id="b">x</button>`;
    expect(isVisuallyAvailableForKeyboardPath(ctx(), document.getElementById("b")!)).toBe(true);
  });
});
