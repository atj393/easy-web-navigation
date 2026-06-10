/**
 * @easy-web-navigation/focus-overlay
 *
 * A user-initiated, READ-ONLY visual helper. It draws rectangles around
 * elements (the live keyboard-focused element, or a scanned issue element the
 * user asked to "locate") and numbered tab-path markers, all inside a single
 * extension-owned container.
 *
 * Hard guarantees:
 *  - It NEVER mutates inspected page elements: no attributes, no classes, no
 *    wrapping, no moving, no event listeners on them.
 *  - It owns exactly one container, isolated in a shadow root, fixed-position,
 *    pointer-events:none, aria-hidden. It cannot steal focus or block input.
 *  - It cleans up fully on unmount()/destroy(): container removed, all window
 *    listeners detached, all timers cleared.
 */

export type HighlightType = "focus" | "locate";

export interface HighlightOptions {
  /** Stable key for this highlight. Defaults to the type. */
  id?: string;
  /** Visual style. Defaults to "focus". */
  type?: HighlightType;
  /** If set, the highlight is auto-removed after this many milliseconds. */
  durationMs?: number;
}

export interface FocusOverlayOptions {
  /** Document the overlay attaches to. Defaults to the ambient document. */
  doc?: Document;
}

interface Highlight {
  element: Element;
  box: HTMLElement;
  type: HighlightType;
  timer?: ReturnType<typeof setTimeout>;
}

interface TabMarker {
  element: Element;
  box: HTMLElement;
  num: HTMLElement;
}

const CONTAINER_STYLE =
  "position:fixed;top:0;left:0;width:0;height:0;margin:0;padding:0;border:0;" +
  "z-index:2147483647;pointer-events:none;";

const SHADOW_CSS = `
:host { all: initial; }
.box {
  position: fixed;
  box-sizing: border-box;
  pointer-events: none;
  border-radius: 3px;
  transition: none;
}
.box--focus {
  border: 3px solid #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.35);
}
.box--locate {
  border: 3px dashed #f97316;
  background: rgba(249, 115, 22, 0.12);
}
.tab-box {
  position: fixed;
  box-sizing: border-box;
  pointer-events: none;
  border: 1px dashed rgba(37, 99, 235, 0.7);
  border-radius: 2px;
}
.tab-num {
  position: fixed;
  pointer-events: none;
  transform: translate(-2px, -2px);
  background: #2563eb;
  color: #fff;
  font: 700 11px/1.4 system-ui, -apple-system, sans-serif;
  padding: 0 5px;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
  white-space: nowrap;
}
`;

export class FocusOverlayController {
  private readonly doc: Document;
  private readonly view: (Window & typeof globalThis) | null;
  private container: HTMLElement | null = null;
  private layer: ShadowRoot | null = null;
  private readonly highlights = new Map<string, Highlight>();
  private tabMarkers: TabMarker[] = [];
  private rafPending = false;
  private readonly onViewportChange = (): void => this.scheduleReposition();

  constructor(options: FocusOverlayOptions = {}) {
    this.doc = options.doc ?? (globalThis.document as Document);
    let view: (Window & typeof globalThis) | null = null;
    try {
      view = (this.doc?.defaultView as (Window & typeof globalThis) | null) ?? null;
    } catch {
      view = null;
    }
    this.view = view;
  }

  /** Create and attach the overlay container. Idempotent. */
  mount(): void {
    if (this.container || !this.doc?.body) return;

    const container = this.doc.createElement("div");
    container.setAttribute("data-easy-web-navigation-overlay", "");
    container.setAttribute("aria-hidden", "true");
    container.style.cssText = CONTAINER_STYLE;

    let layer: ShadowRoot;
    try {
      layer = container.attachShadow({ mode: "open" });
    } catch {
      // Extremely defensive: if shadow DOM is unavailable, use the container.
      layer = container as unknown as ShadowRoot;
    }
    const style = this.doc.createElement("style");
    style.textContent = SHADOW_CSS;
    layer.appendChild(style);

    this.doc.body.appendChild(container);
    this.container = container;
    this.layer = layer;

    this.view?.addEventListener("scroll", this.onViewportChange, true);
    this.view?.addEventListener("resize", this.onViewportChange, true);
  }

  isMounted(): boolean {
    return this.container !== null;
  }

  /**
   * Highlight an element. Creates the container on demand. Returns false when
   * the element is null/disconnected and nothing could be drawn.
   */
  highlightElement(element: Element | null, options: HighlightOptions = {}): boolean {
    const type = options.type ?? "focus";
    const id = options.id ?? type;

    if (!element || !element.isConnected) {
      this.clearHighlight(id);
      return false;
    }

    this.mount();
    if (!this.layer) return false;

    let highlight = this.highlights.get(id);
    if (!highlight) {
      const box = this.doc.createElement("div");
      box.className = `box box--${type}`;
      this.layer.appendChild(box);
      highlight = { element, box, type };
      this.highlights.set(id, highlight);
    } else {
      highlight.element = element;
      highlight.type = type;
      highlight.box.className = `box box--${type}`;
      if (highlight.timer) {
        clearTimeout(highlight.timer);
        highlight.timer = undefined;
      }
    }

    this.positionBox(highlight);

    if (options.durationMs && options.durationMs > 0) {
      highlight.timer = setTimeout(() => this.clearHighlight(id), options.durationMs);
    }
    return true;
  }

  /** Convenience: track the keyboard-focused element under the "focus" id. */
  updateForElement(element: Element | null): boolean {
    return this.highlightElement(element, { id: "focus", type: "focus" });
  }

  /** Remove a single highlight by id. */
  clearHighlight(id: string): void {
    const highlight = this.highlights.get(id);
    if (!highlight) return;
    if (highlight.timer) clearTimeout(highlight.timer);
    highlight.box.remove();
    this.highlights.delete(id);
  }

  /** Remove every highlight (focus/locate). Does not touch tab-path markers. */
  clearAll(): void {
    for (const id of [...this.highlights.keys()]) this.clearHighlight(id);
  }

  /**
   * Draw numbered tab-path markers for the given elements, in array order
   * (marker N = elements[N-1]). Replaces any existing tab path. Read-only:
   * markers live in the overlay; inspected elements are never touched.
   */
  showTabPath(elements: Element[]): void {
    this.clearTabPath();
    this.mount();
    if (!this.layer) return;
    elements.forEach((element, i) => {
      if (!element || !element.isConnected) return;
      const box = this.doc.createElement("div");
      box.className = "tab-box";
      const num = this.doc.createElement("div");
      num.className = "tab-num";
      num.textContent = String(i + 1);
      this.layer!.appendChild(box);
      this.layer!.appendChild(num);
      const marker: TabMarker = { element, box, num };
      this.tabMarkers.push(marker);
      this.positionMarker(marker);
    });
  }

  /** Remove all tab-path markers. */
  clearTabPath(): void {
    for (const marker of this.tabMarkers) {
      marker.box.remove();
      marker.num.remove();
    }
    this.tabMarkers = [];
  }

  /** Whether tab-path markers are currently shown. */
  getTabPathState(): boolean {
    return this.tabMarkers.length > 0;
  }

  /** Whether the overlay is currently showing anything. */
  hasContent(): boolean {
    return this.highlights.size > 0 || this.tabMarkers.length > 0;
  }

  /** Detach listeners, clear all overlay content, and remove the container. */
  unmount(): void {
    this.view?.removeEventListener("scroll", this.onViewportChange, true);
    this.view?.removeEventListener("resize", this.onViewportChange, true);
    this.clearAll();
    this.clearTabPath();
    this.container?.remove();
    this.container = null;
    this.layer = null;
    this.rafPending = false;
  }

  /** Full teardown. Equivalent to unmount() for this controller. */
  destroy(): void {
    this.unmount();
  }

  private positionBox(highlight: Highlight): void {
    const { element, box } = highlight;
    if (!element.isConnected) return;
    let rect: DOMRect;
    try {
      rect = element.getBoundingClientRect();
    } catch {
      return;
    }
    box.style.left = `${rect.left}px`;
    box.style.top = `${rect.top}px`;
    box.style.width = `${rect.width}px`;
    box.style.height = `${rect.height}px`;
  }

  private positionMarker(marker: TabMarker): void {
    const { element, box, num } = marker;
    if (!element.isConnected) return;
    let rect: DOMRect;
    try {
      rect = element.getBoundingClientRect();
    } catch {
      return;
    }
    box.style.left = `${rect.left}px`;
    box.style.top = `${rect.top}px`;
    box.style.width = `${rect.width}px`;
    box.style.height = `${rect.height}px`;
    num.style.left = `${rect.left}px`;
    num.style.top = `${rect.top}px`;
  }

  private reposition(): void {
    for (const [id, highlight] of [...this.highlights.entries()]) {
      if (!highlight.element.isConnected) {
        this.clearHighlight(id);
        continue;
      }
      this.positionBox(highlight);
    }
    if (this.tabMarkers.some((m) => !m.element.isConnected)) {
      // Drop markers whose elements left the DOM.
      const live: TabMarker[] = [];
      for (const marker of this.tabMarkers) {
        if (marker.element.isConnected) {
          live.push(marker);
        } else {
          marker.box.remove();
          marker.num.remove();
        }
      }
      this.tabMarkers = live;
    }
    for (const marker of this.tabMarkers) this.positionMarker(marker);
  }

  private scheduleReposition(): void {
    if (this.rafPending) return;
    this.rafPending = true;
    const raf =
      this.view?.requestAnimationFrame?.bind(this.view) ??
      ((cb: FrameRequestCallback) => setTimeout(() => cb(0), 16));
    raf(() => {
      this.rafPending = false;
      this.reposition();
    });
  }
}
