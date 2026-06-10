import { describe, it, expect, beforeEach } from "vitest";
import {
  computeTabPath,
  sortFocusableElementsForTabOrder,
  resolveTabIndex,
  DEFAULT_TAB_PATH_CAP,
} from "./index";

beforeEach(() => {
  document.title = "Test";
  document.body.innerHTML = "";
});

function selectors(): string[] {
  return computeTabPath(document).items.map((i) => i.selector);
}

describe("resolveTabIndex", () => {
  it("treats a missing tabindex as 0", () => {
    document.body.innerHTML = `<button id="b">x</button>`;
    expect(resolveTabIndex(document.getElementById("b")!)).toBe(0);
  });

  it("parses explicit tabindex values", () => {
    document.body.innerHTML = `<div id="d" tabindex="5"></div>`;
    expect(resolveTabIndex(document.getElementById("d")!)).toBe(5);
  });
});

describe("sortFocusableElementsForTabOrder", () => {
  it("orders positive tabindex first (asc), then DOM order; drops negatives", () => {
    document.body.innerHTML = `
      <button id="b0">0</button>
      <button id="b2" tabindex="2">2</button>
      <button id="b1" tabindex="1">1</button>
      <button id="neg" tabindex="-1">n</button>
    `;
    const els = Array.from(document.querySelectorAll("button"));
    const ordered = sortFocusableElementsForTabOrder(els).map((e) => e.id);
    expect(ordered).toEqual(["b1", "b2", "b0"]);
  });

  it("keeps DOM order for equal positive tabindex", () => {
    document.body.innerHTML = `
      <button id="x" tabindex="1">x</button>
      <button id="y" tabindex="1">y</button>
    `;
    const els = Array.from(document.querySelectorAll("button"));
    expect(sortFocusableElementsForTabOrder(els).map((e) => e.id)).toEqual(["x", "y"]);
  });
});

describe("computeTabPath", () => {
  it("returns natural focusables in DOM order", () => {
    document.body.innerHTML = `
      <button id="a">a</button>
      <a id="b" href="#">b</a>
      <input id="c" type="text" />
    `;
    expect(selectors()).toEqual(["#a", "#b", "#c"]);
  });

  it("places positive tabindex before tabindex 0 / natural", () => {
    document.body.innerHTML = `
      <button id="b3" tabindex="3">3</button>
      <button id="b1" tabindex="1">1</button>
      <button id="b0">0</button>
      <button id="b2" tabindex="2">2</button>
    `;
    expect(selectors()).toEqual(["#b1", "#b2", "#b3", "#b0"]);
  });

  it("excludes negative tabindex elements", () => {
    document.body.innerHTML = `
      <button id="keep">k</button>
      <button id="skip" tabindex="-1">s</button>
    `;
    expect(selectors()).toEqual(["#keep"]);
  });

  it("excludes disabled and hidden elements", () => {
    document.body.innerHTML = `
      <button id="ok">ok</button>
      <button id="dis" disabled>d</button>
      <button id="hid" hidden>h</button>
      <div hidden><button id="anc">a</button></div>
    `;
    expect(selectors()).toEqual(["#ok"]);
  });

  it("records index, tagName, tabIndex, and accessibleName", () => {
    document.body.innerHTML = `<button id="save" tabindex="2">Save</button>`;
    const item = computeTabPath(document).items[0];
    expect(item.index).toBe(1);
    expect(item.tagName).toBe("button");
    expect(item.tabIndex).toBe(2);
    expect(item.accessibleName).toBe("Save");
    expect(item.selector).toBe("#save");
  });

  it("summarizes shown/total and capped=false under the cap", () => {
    document.body.innerHTML = `<button>a</button><button>b</button>`;
    const { summary } = computeTabPath(document);
    expect(summary).toEqual({ shown: 2, totalDetected: 2, capped: false });
  });

  it("caps to maxItems and reports capped=true", () => {
    document.body.innerHTML = `<button>a</button><button>b</button><button>c</button>`;
    const { items, summary } = computeTabPath(document, { maxItems: 2 });
    expect(items).toHaveLength(2);
    expect(summary).toEqual({ shown: 2, totalDetected: 3, capped: true });
  });

  it("applies the default cap of 100 on large pages", () => {
    const buttons = Array.from(
      { length: DEFAULT_TAB_PATH_CAP + 5 },
      (_, i) => `<button>${i}</button>`,
    );
    document.body.innerHTML = buttons.join("");
    const { items, summary } = computeTabPath(document);
    expect(items).toHaveLength(DEFAULT_TAB_PATH_CAP);
    expect(summary.totalDetected).toBe(DEFAULT_TAB_PATH_CAP + 5);
    expect(summary.capped).toBe(true);
  });
});
