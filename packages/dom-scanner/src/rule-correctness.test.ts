/**
 * Rule-correctness regression tests.
 *
 * Each case below is a pattern that appears on ordinary, correctly-built pages
 * and that the scanner previously got wrong — either reporting a problem that
 * is not one (a false positive, which teaches users to distrust the tool) or
 * missing one that is (a false negative, which is worse: a clean result the
 * user believes).
 */
import { describe, it, expect, beforeEach } from "vitest";
import type { ScanResult } from "@easy-web-navigation/shared-types";
import {
  collectFocusableElements,
  createScanContext,
  getAccessibleName,
  scanDocument,
} from "./index";

function scan(): ScanResult {
  return scanDocument(document, {}, () => 0);
}

function issuesFor(ruleId: string) {
  return scan().issues.filter((i) => i.ruleId === ruleId);
}

function nameOf(selector: string): string {
  const ctx = createScanContext(document, {});
  const el = document.querySelector(selector);
  if (!el) throw new Error(`no element for ${selector}`);
  return getAccessibleName(ctx, el);
}

beforeEach(() => {
  document.title = "Test Page";
  document.body.innerHTML = "";
});

describe("clickable-not-focusable: false positives", () => {
  it("does not flag a disabled control", () => {
    // A disabled control is deliberately out of the tab order.
    document.body.innerHTML = `<main><button onclick="x()" disabled>Save</button></main>`;
    expect(issuesFor("clickable-not-focusable")).toHaveLength(0);
  });

  it("does not flag an aria-disabled control", () => {
    document.body.innerHTML = `<main><div role="button" aria-disabled="true">Save</div></main>`;
    expect(issuesFor("clickable-not-focusable")).toHaveLength(0);
  });

  it("does not flag a control inside an aria-disabled group", () => {
    document.body.innerHTML = `
      <main>
        <div aria-disabled="true"><div role="button">Save</div></div>
      </main>`;
    expect(issuesFor("clickable-not-focusable")).toHaveLength(0);
  });

  it("does not flag controls inside an inert subtree", () => {
    // Everything behind an open modal is inert; the browser removes it from
    // the tab order, which is correct rather than broken.
    document.body.innerHTML = `<main inert><div role="button">Behind the dialog</div></main>`;
    expect(issuesFor("clickable-not-focusable")).toHaveLength(0);
  });

  it("does not flag the inactive tabs of a correct tablist", () => {
    // Roving tabindex: exactly one tab is tabbable, arrows move between them.
    document.body.innerHTML = `
      <main>
        <div role="tablist">
          <button role="tab" tabindex="0" aria-selected="true">One</button>
          <button role="tab" tabindex="-1">Two</button>
          <button role="tab" tabindex="-1">Three</button>
        </div>
      </main>`;
    expect(issuesFor("clickable-not-focusable")).toHaveLength(0);
  });

  it("does not flag the inactive items of a correct menu or radiogroup", () => {
    document.body.innerHTML = `
      <main>
        <div role="menu">
          <div role="menuitem" tabindex="0">Copy</div>
          <div role="menuitem" tabindex="-1">Paste</div>
        </div>
        <div role="radiogroup">
          <div role="radio" tabindex="0" aria-checked="true">Yes</div>
          <div role="radio" tabindex="-1">No</div>
        </div>
      </main>`;
    expect(issuesFor("clickable-not-focusable")).toHaveLength(0);
  });

  it("still flags a tablist where NO tab is reachable", () => {
    // Without a tabbable member the widget is genuinely unreachable, and the
    // roving-tabindex exemption must not hide that.
    document.body.innerHTML = `
      <main>
        <div role="tablist">
          <div role="tab" tabindex="-1">One</div>
          <div role="tab" tabindex="-1">Two</div>
        </div>
      </main>`;
    expect(issuesFor("clickable-not-focusable")).toHaveLength(2);
  });

  it("still flags a role element outside any composite container", () => {
    document.body.innerHTML = `<main><div role="tab" tabindex="-1">Lonely</div></main>`;
    expect(issuesFor("clickable-not-focusable")).toHaveLength(1);
  });

  it("treats an invalid tabindex as absent, per the HTML spec", () => {
    // <button tabindex="abc"> is still a focusable button.
    document.body.innerHTML = `<main><button onclick="x()" tabindex="abc">Go</button></main>`;
    expect(issuesFor("clickable-not-focusable")).toHaveLength(0);
  });
});

describe("accessible names: false negatives", () => {
  it("does not treat a dropdown's options as its name", () => {
    document.body.innerHTML = `
      <main>
        <select id="s"><option>Red</option><option>Blue</option></select>
      </main>`;
    expect(nameOf("#s")).toBe("");
    expect(issuesFor("unlabeled-form-input")).toHaveLength(1);
  });

  it("does not treat a dropdown wrapped in a bare label as labelled", () => {
    // The label's textContent contains the option text, which is the control's
    // value rather than its name.
    document.body.innerHTML = `
      <main><label><select id="s"><option>Red</option></select></label></main>`;
    expect(nameOf("#s")).toBe("");
    expect(issuesFor("unlabeled-form-input")).toHaveLength(1);
  });

  it("does not treat a textarea's contents as its name", () => {
    document.body.innerHTML = `<main><textarea id="t">Draft text</textarea></main>`;
    expect(nameOf("#t")).toBe("");
    expect(issuesFor("unlabeled-form-input")).toHaveLength(1);
  });

  it("still accepts a real label on a dropdown", () => {
    document.body.innerHTML = `
      <main>
        <label for="s">Colour</label>
        <select id="s"><option>Red</option></select>
        <label>Size <select id="s2"><option>M</option></select></label>
      </main>`;
    expect(nameOf("#s")).toBe("Colour");
    expect(nameOf("#s2")).toBe("Size");
    expect(issuesFor("unlabeled-form-input")).toHaveLength(0);
  });

  it("ignores a decorative glyph that is hidden from assistive technology", () => {
    document.body.innerHTML = `<main><button id="b"><span aria-hidden="true">&times;</span></button></main>`;
    expect(nameOf("#b")).toBe("");
    expect(issuesFor("unlabeled-control")).toHaveLength(1);
  });

  it("ignores an image marked decorative with an empty alt", () => {
    document.body.innerHTML = `<main><a id="a" href="/x"><img src="i.png" alt="" /></a></main>`;
    expect(nameOf("#a")).toBe("");
    expect(issuesFor("unlabeled-control")).toHaveLength(1);
  });
});

describe("accessible names: false positives", () => {
  it("reads a label from an icon child, the ordinary icon-button pattern", () => {
    document.body.innerHTML = `<main><button id="b"><svg aria-label="Close"></svg></button></main>`;
    expect(nameOf("#b")).toBe("Close");
    expect(issuesFor("unlabeled-control")).toHaveLength(0);
  });

  it("reads a nested image's alt text", () => {
    document.body.innerHTML = `<main><button id="b"><img src="i.png" alt="Search" /></button></main>`;
    expect(nameOf("#b")).toBe("Search");
    expect(issuesFor("unlabeled-control")).toHaveLength(0);
  });

  it("combines a hidden glyph with real screen-reader text", () => {
    document.body.innerHTML = `
      <main>
        <button id="b"><span aria-hidden="true">&times;</span><span>Close dialog</span></button>
      </main>`;
    expect(nameOf("#b")).toBe("Close dialog");
    expect(issuesFor("unlabeled-control")).toHaveLength(0);
  });
});

describe("hidden detection across shadow boundaries", () => {
  it("treats a control inside a hidden shadow host as hidden", () => {
    document.body.innerHTML = `<main><div id="host" style="display:none"></div></main>`;
    const host = document.getElementById("host")!;
    host.attachShadow({ mode: "open" }).innerHTML = `<div role="button">Inside</div>`;
    // Walking only parentElement stopped at the shadow root and never saw the
    // host's display:none, so this used to be reported as a real problem.
    expect(issuesFor("clickable-not-focusable")).toHaveLength(0);
  });

  it("still inspects a control inside a visible shadow host", () => {
    document.body.innerHTML = `<main><div id="host"></div></main>`;
    const host = document.getElementById("host")!;
    host.attachShadow({ mode: "open" }).innerHTML = `<div role="button">Inside</div>`;
    expect(issuesFor("clickable-not-focusable")).toHaveLength(1);
  });
});

describe("positive-tabindex reports only what a user can encounter", () => {
  it("ignores hidden markup, like every other rule", () => {
    document.body.innerHTML = `
      <main>
        <div tabindex="3" style="display:none">hidden</div>
        <div tabindex="4">visible</div>
      </main>`;
    const issues = issuesFor("positive-tabindex");
    expect(issues).toHaveLength(1);
    expect(issues[0].elementPreview).toContain("visible");
  });

  it("ignores markup inside an aria-hidden region", () => {
    document.body.innerHTML = `<main><div aria-hidden="true"><a href="#" tabindex="9">x</a></div></main>`;
    expect(issuesFor("positive-tabindex")).toHaveLength(0);
  });
});

describe("skip links written in other words", () => {
  const page = (link: string) => `
    <header><nav><a href="/a">A</a></nav>${link}</header>
    <main id="main">Body</main>`;

  it("accepts 'Jump to content' as a skip link", () => {
    document.body.innerHTML = page(`<a href="#main">Jump to content</a>`);
    expect(issuesFor("missing-skip-link")).toHaveLength(0);
  });

  it("still accepts the conventional wording", () => {
    document.body.innerHTML = page(`<a href="#main">Skip to main content</a>`);
    expect(issuesFor("missing-skip-link")).toHaveLength(0);
  });

  it("still reports a page with navigation and no skip link at all", () => {
    document.body.innerHTML = page("");
    expect(issuesFor("missing-skip-link")).toHaveLength(1);
  });
});

describe("focusable counting", () => {
  it("counts <summary> rather than its <details> wrapper", () => {
    // <details> itself never takes focus; only its <summary> does. Counting
    // both inflated the "items that can take keyboard focus" figure.
    document.body.innerHTML = `<main><details><summary>More</summary><p>Body</p></details></main>`;
    const focusable = collectFocusableElements(createScanContext(document, {}));
    expect(focusable.map((el) => el.tagName)).toEqual(["SUMMARY"]);
  });

  it("does not treat `disabled` on a non-form element as disabling", () => {
    // The attribute is only meaningful on form controls; on a <div> it is
    // inert markup and must not change what the scanner reports.
    document.body.innerHTML = `<main><div role="button" disabled>Save</div></main>`;
    expect(issuesFor("clickable-not-focusable")).toHaveLength(1);
  });
});
