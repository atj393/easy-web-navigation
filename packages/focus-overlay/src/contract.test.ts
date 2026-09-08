/**
 * The overlay's product contract.
 *
 * Easy Web Navigation inspects other people's websites. The single rule that
 * makes that acceptable is that it never changes them: the only DOM it may
 * create is its own isolated container, and that container must leave no trace
 * once it is no longer wanted. These tests guard that rule directly, plus the
 * read-then-write discipline that keeps drawing hundreds of markers from
 * freezing the page.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { FocusOverlayController } from "./index";

const OVERLAY_SELECTOR = "[data-easy-web-navigation-overlay]";

/** The inspected page, excluding anything the extension owns. */
function pageSnapshot(): string {
  const clone = document.body.cloneNode(true) as HTMLElement;
  for (const own of Array.from(clone.querySelectorAll(OVERLAY_SELECTOR))) own.remove();
  return clone.innerHTML;
}

function buildPage(count: number): Element[] {
  document.body.innerHTML = Array.from(
    { length: count },
    (_, i) => `<button id="b${i}" class="page-control">Item ${i}</button>`,
  ).join("");
  return Array.from(document.querySelectorAll("button"));
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("read-only contract", () => {
  it("leaves every inspected node byte-identical", () => {
    const elements = buildPage(5);
    const before = pageSnapshot();

    const overlay = new FocusOverlayController({ doc: document });
    overlay.showTabPath(elements);
    overlay.updateForElement(elements[2]);
    overlay.highlightElement(elements[3], { id: "locate", type: "locate" });

    expect(pageSnapshot()).toBe(before);
  });

  it("never adds attributes, classes, or inline styles to page elements", () => {
    const elements = buildPage(3);
    const overlay = new FocusOverlayController({ doc: document });
    overlay.showTabPath(elements);
    overlay.updateForElement(elements[0]);

    for (const el of elements) {
      expect(el.getAttributeNames().sort()).toEqual(["class", "id"]);
      expect(el.className).toBe("page-control");
      expect((el as HTMLElement).style.cssText).toBe("");
    }
  });

  it("owns exactly one container, and it cannot take focus or block clicks", () => {
    const overlay = new FocusOverlayController({ doc: document });
    overlay.showTabPath(buildPage(2));
    overlay.updateForElement(document.querySelector("button"));

    const containers = document.querySelectorAll(OVERLAY_SELECTOR);
    expect(containers).toHaveLength(1);
    const container = containers[0] as HTMLElement;
    expect(container.getAttribute("aria-hidden")).toBe("true");
    expect(container.getAttribute("tabindex")).toBeNull();
    expect(container.style.pointerEvents).toBe("none");
    // Nothing focusable inside, so the overlay cannot enter the tab order.
    expect(container.shadowRoot?.querySelectorAll("a, button, input, [tabindex]")).toHaveLength(0);
  });

  it("removes itself completely on unmount", () => {
    const overlay = new FocusOverlayController({ doc: document });
    const elements = buildPage(3);
    const before = pageSnapshot();
    overlay.showTabPath(elements);
    overlay.unmount();

    expect(document.querySelectorAll(OVERLAY_SELECTOR)).toHaveLength(0);
    expect(document.body.innerHTML).toBe(before);
  });
});

describe("lifecycle", () => {
  it("does not leak listeners across repeated enable and disable cycles", () => {
    const view = document.defaultView!;
    const added = vi.spyOn(view, "addEventListener");
    const removed = vi.spyOn(view, "removeEventListener");

    const overlay = new FocusOverlayController({ doc: document });
    const elements = buildPage(2);
    for (let i = 0; i < 5; i += 1) {
      overlay.showTabPath(elements);
      overlay.unmount();
    }

    const countFor = (spy: typeof added, type: string) =>
      spy.mock.calls.filter((call) => call[0] === type).length;
    expect(countFor(added, "scroll")).toBe(countFor(removed, "scroll"));
    expect(countFor(added, "resize")).toBe(countFor(removed, "resize"));
    expect(document.querySelectorAll(OVERLAY_SELECTOR)).toHaveLength(0);

    added.mockRestore();
    removed.mockRestore();
  });

  it("tells the owner when a timed highlight leaves nothing on screen", async () => {
    // A "locate" flash used to leave the container attached to the page for the
    // rest of the session.
    vi.useFakeTimers();
    const onIdle = vi.fn();
    const overlay = new FocusOverlayController({ doc: document, onIdle });
    const [button] = buildPage(1);

    overlay.highlightElement(button, { id: "locate", type: "locate", durationMs: 2000 });
    expect(overlay.hasContent()).toBe(true);
    expect(onIdle).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2000);
    expect(overlay.hasContent()).toBe(false);
    expect(onIdle).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("does not report idle while another highlight is still showing", () => {
    vi.useFakeTimers();
    const onIdle = vi.fn();
    const overlay = new FocusOverlayController({ doc: document, onIdle });
    const elements = buildPage(2);

    overlay.updateForElement(elements[0]);
    overlay.highlightElement(elements[1], { id: "locate", type: "locate", durationMs: 100 });
    vi.advanceTimersByTime(100);

    expect(onIdle).not.toHaveBeenCalled();
    expect(overlay.hasContent()).toBe(true);
    vi.useRealTimers();
  });

  it("rebuilds itself when a single-page app replaces the body", () => {
    const overlay = new FocusOverlayController({ doc: document });
    overlay.showTabPath(buildPage(2));
    expect(overlay.isMounted()).toBe(true);

    // The framework swaps <body>'s contents, detaching our container.
    document.body.innerHTML = "<main>New route</main>";
    expect(overlay.isMounted()).toBe(false);

    document.body.innerHTML += `<button id="new">New</button>`;
    overlay.showTabPath([document.getElementById("new")!]);
    expect(overlay.isMounted()).toBe(true);
    expect(document.querySelectorAll(OVERLAY_SELECTOR)).toHaveLength(1);
  });
});

describe("drawing many markers", () => {
  /**
   * Measuring an element after appending the previous marker forces a
   * synchronous layout every iteration. This counts the interleavings rather
   * than wall-clock time, so it is stable in CI.
   */
  it("reads all geometry before writing any nodes", () => {
    const elements = buildPage(200);
    const order: ("read" | "write")[] = [];

    const proto = Element.prototype as unknown as {
      getBoundingClientRect: () => DOMRect;
    };
    const originalRect = proto.getBoundingClientRect;
    proto.getBoundingClientRect = function measured(this: Element) {
      if (this.closest?.(OVERLAY_SELECTOR) === null) order.push("read");
      return originalRect.call(this);
    } as typeof originalRect;

    const originalAppend = ShadowRoot.prototype.appendChild;
    ShadowRoot.prototype.appendChild = function appended<T extends Node>(
      this: ShadowRoot,
      node: T,
    ) {
      // The container's own <style> is attached at mount, before any marker
      // work; only marker attachment is interesting here.
      if (node.nodeName !== "STYLE") order.push("write");
      return originalAppend.call(this, node) as T;
    } as typeof originalAppend;

    try {
      new FocusOverlayController({ doc: document }).showTabPath(elements);
    } finally {
      proto.getBoundingClientRect = originalRect;
      ShadowRoot.prototype.appendChild = originalAppend;
    }

    const firstWrite = order.indexOf("write");
    const lastRead = order.lastIndexOf("read");
    expect(order.filter((o) => o === "read")).toHaveLength(elements.length);
    // Every measurement happens before the first marker node is attached.
    expect(lastRead).toBeLessThan(firstWrite);
  });

  it("attaches the marker nodes in a single batch", () => {
    const elements = buildPage(150);
    const overlay = new FocusOverlayController({ doc: document });
    const appends: string[] = [];
    const originalAppend = ShadowRoot.prototype.appendChild;
    ShadowRoot.prototype.appendChild = function appended<T extends Node>(
      this: ShadowRoot,
      node: T,
    ) {
      appends.push(node.nodeName);
      return originalAppend.call(this, node) as T;
    } as typeof originalAppend;

    try {
      overlay.showTabPath(elements);
    } finally {
      ShadowRoot.prototype.appendChild = originalAppend;
    }

    // One <style> at mount plus one fragment carrying all 300 marker nodes.
    expect(appends).toEqual(["STYLE", "#document-fragment"]);
    const container = document.querySelector(OVERLAY_SELECTOR)!;
    expect(container.shadowRoot!.querySelectorAll(".tab-box")).toHaveLength(150);
    expect(container.shadowRoot!.querySelectorAll(".tab-num")).toHaveLength(150);
  });

  it("numbers markers in tab order", () => {
    const elements = buildPage(4);
    new FocusOverlayController({ doc: document }).showTabPath(elements);
    const nums = [
      ...document.querySelector(OVERLAY_SELECTOR)!.shadowRoot!.querySelectorAll(".tab-num"),
    ];
    expect(nums.map((n) => n.textContent)).toEqual(["1", "2", "3", "4"]);
  });
});
