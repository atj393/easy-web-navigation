import { describe, it, expect, beforeEach } from "vitest";
import type { ScanResult } from "@keywise/shared-types";
import {
  scanDocument,
  getStableSelector,
  getElementPreview,
  collectFocusableElements,
  createScanContext,
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
