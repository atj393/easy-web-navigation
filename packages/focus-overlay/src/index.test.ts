import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { FocusOverlayController } from "./index";

/** Give an element a fake layout box (jsdom does no layout). */
function mockRect(el: Element, rect: Partial<DOMRect>): void {
  const full = { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, ...rect };
  el.getBoundingClientRect = () => ({ ...full, toJSON: () => full }) as DOMRect;
}

function boxes(): NodeListOf<Element> {
  const container = document.querySelector("[data-easy-web-navigation-overlay]");
  return container!.shadowRoot!.querySelectorAll(".box");
}

function tabNums(): NodeListOf<Element> {
  const container = document.querySelector("[data-easy-web-navigation-overlay]");
  return container!.shadowRoot!.querySelectorAll(".tab-num");
}

let controller: FocusOverlayController;

beforeEach(() => {
  document.body.innerHTML = "";
  controller = new FocusOverlayController({ doc: document });
});

afterEach(() => {
  controller.destroy();
  vi.useRealTimers();
});

describe("FocusOverlayController mount/unmount", () => {
  it("mounts a single isolated, non-interactive container", () => {
    expect(controller.isMounted()).toBe(false);
    controller.mount();
    expect(controller.isMounted()).toBe(true);

    const container = document.querySelector("[data-easy-web-navigation-overlay]") as HTMLElement;
    expect(container).not.toBeNull();
    expect(container.style.pointerEvents).toBe("none");
    expect(container.getAttribute("aria-hidden")).toBe("true");
    expect(container.shadowRoot).not.toBeNull();
  });

  it("is idempotent on repeated mount", () => {
    controller.mount();
    controller.mount();
    expect(document.querySelectorAll("[data-easy-web-navigation-overlay]").length).toBe(1);
  });

  it("removes the container on unmount", () => {
    controller.mount();
    controller.unmount();
    expect(controller.isMounted()).toBe(false);
    expect(document.querySelector("[data-easy-web-navigation-overlay]")).toBeNull();
  });
});

describe("highlightElement", () => {
  it("draws a box positioned from the element rect", () => {
    document.body.innerHTML = `<button id="t">Hi</button>`;
    const el = document.getElementById("t")!;
    mockRect(el, { left: 10, top: 20, width: 100, height: 30 });

    expect(controller.highlightElement(el, { type: "focus" })).toBe(true);
    const box = boxes()[0] as HTMLElement;
    expect(box).toBeTruthy();
    expect(box.style.left).toBe("10px");
    expect(box.style.top).toBe("20px");
    expect(box.style.width).toBe("100px");
    expect(box.style.height).toBe("30px");
    expect(box.className).toContain("box--focus");
  });

  it("does not mutate the target element", () => {
    document.body.innerHTML = `<button id="t" class="orig">Hi</button>`;
    const el = document.getElementById("t")!;
    mockRect(el, { left: 1, top: 2, width: 3, height: 4 });
    const before = el.outerHTML;
    const attrCount = el.attributes.length;

    controller.highlightElement(el, { type: "locate" });

    expect(el.outerHTML).toBe(before);
    expect(el.attributes.length).toBe(attrCount);
    expect(el.children.length).toBe(0);
  });

  it("reuses one box per id and supports clearing", () => {
    document.body.innerHTML = `<button id="a">A</button><button id="b">B</button>`;
    const a = document.getElementById("a")!;
    const b = document.getElementById("b")!;
    mockRect(a, { width: 10, height: 10 });
    mockRect(b, { width: 20, height: 20 });

    controller.updateForElement(a);
    controller.updateForElement(b); // same "focus" id -> still one box
    expect(boxes().length).toBe(1);

    controller.highlightElement(b, { id: "locate", type: "locate" });
    expect(boxes().length).toBe(2);

    controller.clearHighlight("locate");
    expect(boxes().length).toBe(1);
  });

  it("auto-clears after durationMs", () => {
    vi.useFakeTimers();
    document.body.innerHTML = `<button id="t">Hi</button>`;
    const el = document.getElementById("t")!;
    mockRect(el, { width: 10, height: 10 });

    controller.highlightElement(el, { id: "locate", type: "locate", durationMs: 2000 });
    expect(boxes().length).toBe(1);

    vi.advanceTimersByTime(2000);
    expect(boxes().length).toBe(0);
  });

  it("is safe with null or disconnected elements", () => {
    expect(controller.highlightElement(null)).toBe(false);

    const orphan = document.createElement("div"); // never attached
    expect(controller.highlightElement(orphan)).toBe(false);
  });
});

describe("destroy", () => {
  it("clears highlights and removes the container", () => {
    document.body.innerHTML = `<button id="t">Hi</button>`;
    const el = document.getElementById("t")!;
    mockRect(el, { width: 10, height: 10 });
    controller.highlightElement(el);
    expect(controller.isMounted()).toBe(true);

    controller.destroy();
    expect(controller.isMounted()).toBe(false);
    expect(document.querySelector("[data-easy-web-navigation-overlay]")).toBeNull();
  });
});

describe("tab path markers", () => {
  function makeButtons(n: number): Element[] {
    document.body.innerHTML = Array.from({ length: n }, (_, i) => `<button>${i}</button>`).join("");
    const els = Array.from(document.querySelectorAll("button"));
    els.forEach((el, i) => mockRect(el, { left: i * 10, top: i * 20, width: 50, height: 16 }));
    return els;
  }

  it("renders one numbered marker per element, in order", () => {
    const els = makeButtons(3);
    controller.showTabPath(els);
    const nums = tabNums();
    expect(nums.length).toBe(3);
    expect(Array.from(nums).map((n) => n.textContent)).toEqual(["1", "2", "3"]);
    expect(controller.getTabPathState()).toBe(true);
  });

  it("positions the marker box from the element rect", () => {
    const els = makeButtons(1);
    controller.showTabPath(els);
    const container = document.querySelector("[data-easy-web-navigation-overlay]")!;
    const box = container.shadowRoot!.querySelector(".tab-box") as HTMLElement;
    expect(box.style.width).toBe("50px");
    expect(box.style.height).toBe("16px");
  });

  it("does not mutate the inspected elements", () => {
    const els = makeButtons(2);
    const before = els.map((e) => e.outerHTML);
    controller.showTabPath(els);
    expect(els.map((e) => e.outerHTML)).toEqual(before);
  });

  it("clearTabPath removes markers but keeps other highlights", () => {
    const els = makeButtons(2);
    mockRect(els[0], { width: 10, height: 10 });
    controller.highlightElement(els[0], { id: "focus", type: "focus" });
    controller.showTabPath(els);
    expect(tabNums().length).toBe(2);

    controller.clearTabPath();
    expect(tabNums().length).toBe(0);
    expect(controller.getTabPathState()).toBe(false);
    expect(controller.hasContent()).toBe(true); // the focus highlight remains
  });

  it("re-showing replaces the previous tab path", () => {
    const els = makeButtons(3);
    controller.showTabPath(els);
    expect(tabNums().length).toBe(3);
    controller.showTabPath(els.slice(0, 2)); // no DOM reset, just fewer elements
    expect(tabNums().length).toBe(2);
  });

  it("destroy removes tab markers and the container", () => {
    controller.showTabPath(makeButtons(2));
    controller.destroy();
    expect(controller.isMounted()).toBe(false);
    expect(document.querySelector("[data-easy-web-navigation-overlay]")).toBeNull();
  });

  it("skips disconnected elements safely", () => {
    const orphan = document.createElement("button");
    controller.showTabPath([orphan]);
    expect(tabNums().length).toBe(0);
  });
});
