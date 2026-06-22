/**
 * @easy-web-navigation/keyboard-engine
 *
 * Read-only keyboard-order analysis. Computes the order in which keyboard
 * focus would move through a document, reusing `@easy-web-navigation/dom-scanner`'s
 * focusable detection so the two stay consistent.
 *
 * Design constraint: Easy Web Navigation does NOT override global keyboard behavior.
 * It observes focus movement and computes tab order; it never hijacks Tab,
 * arrow keys, or shortcuts, and it never mutates inspected page nodes.
 */
import {
  collectFocusableElements,
  createScanContext,
  getAccessibleName,
  getElementPreview,
  getStableSelector,
  isVisuallyAvailableForKeyboardPath,
} from "@easy-web-navigation/dom-scanner";
import type { TabPathItem, TabPathOptions, TabPathResult } from "@easy-web-navigation/shared-types";

/** Default cap on rendered/returned tab-path items (large-page guard). */
export const DEFAULT_TAB_PATH_CAP = 100;

/** Resolve an element's effective tabindex (0 for naturally focusable). */
export function resolveTabIndex(el: Element): number {
  const attr = el.getAttribute("tabindex");
  if (attr === null) return 0;
  const value = Number.parseInt(attr, 10);
  return Number.isNaN(value) ? 0 : value;
}

/**
 * Order focusable elements the way the browser's sequential focus navigation
 * would: positive tabindex first (ascending, ties keep DOM order), then
 * tabindex=0 / naturally focusable elements in DOM order. Elements with a
 * negative tabindex are not part of the sequential tab order and are dropped.
 *
 * The input is assumed to already be in DOM order (as produced by
 * `collectFocusableElements`); this sort is stable with respect to it.
 */
export function sortFocusableElementsForTabOrder(elements: Element[]): Element[] {
  const tagged = elements.map((el, domIndex) => ({ el, domIndex, ti: resolveTabIndex(el) }));
  const positives = tagged
    .filter((t) => t.ti > 0)
    .sort((a, b) => a.ti - b.ti || a.domIndex - b.domIndex);
  const zeros = tagged.filter((t) => t.ti === 0);
  return [...positives, ...zeros].map((t) => t.el);
}

/** Build a serializable summary from a (possibly capped) item list. */
export function createTabPathSummary(
  items: TabPathItem[],
  totalDetected: number,
): TabPathResult["summary"] {
  return {
    shown: items.length,
    totalDetected,
    capped: totalDetected > items.length,
  };
}

function safeRect(el: Element): TabPathItem["rect"] {
  try {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  } catch {
    return undefined;
  }
}

/**
 * Compute the read-only tab path for a document.
 *
 * Returns serializable `items` + `summary`, plus the parallel `elements`
 * array (live references) so a caller can drive the overlay without
 * recomputing. Nothing here mutates the page.
 */
export function computeTabPath(
  doc: Document = globalThis.document as Document,
  options: TabPathOptions = {},
): TabPathResult & { elements: Element[] } {
  const cap = options.maxItems ?? DEFAULT_TAB_PATH_CAP;
  const ctx = createScanContext(doc, {
    includeHidden: options.includeHidden,
    traverseShadow: options.traverseShadow,
  });

  // Keep the browser-like sequential tab order, then drop controls that are in
  // the tab order but not visually available to a sighted user (collapsed /
  // off-canvas / clipped / inert / content-visibility:hidden). `totalDetected`
  // and the cap apply to this visible set, so the summary and overlay only
  // count/render markers the user can actually see.
  const ordered = sortFocusableElementsForTabOrder(collectFocusableElements(ctx)).filter((el) =>
    isVisuallyAvailableForKeyboardPath(ctx, el),
  );
  const totalDetected = ordered.length;
  const elements = cap >= 0 ? ordered.slice(0, cap) : ordered;

  const items: TabPathItem[] = elements.map((el, i) => {
    const accessibleName = getAccessibleName(ctx, el);
    return {
      index: i + 1,
      selector: getStableSelector(el),
      elementPreview: getElementPreview(el),
      tagName: el.tagName.toLowerCase(),
      accessibleName: accessibleName || undefined,
      tabIndex: resolveTabIndex(el),
      rect: safeRect(el),
    };
  });

  return { items, summary: createTabPathSummary(items, totalDetected), elements };
}

/** Observes which element currently holds focus. No-op until started. */
export class FocusTracker {
  private active = false;

  start(): void {
    // Phase 0A: intentionally does not attach listeners.
    this.active = true;
  }

  stop(): void {
    this.active = false;
  }

  isActive(): boolean {
    return this.active;
  }

  /** The element believed to currently have focus, if known. */
  getCurrentElement(): Element | null {
    return null;
  }
}

/** A single recorded step along the keyboard tab path. */
export interface TabPathStep {
  index: number;
  selector: string;
  preview: string;
}

/** Records the order in which elements receive focus while tabbing. */
export class TabPathRecorder {
  private steps: TabPathStep[] = [];

  reset(): void {
    this.steps = [];
  }

  /** Append a step. Real recording is wired up in a later phase. */
  record(step: TabPathStep): void {
    this.steps.push(step);
  }

  getPath(): readonly TabPathStep[] {
    return this.steps;
  }
}

/**
 * High-level controller that will coordinate optional, user-initiated
 * keyboard assistance. In Phase 0A it only tracks enabled state.
 */
export class KeyboardAssistController {
  private enabled = false;
  readonly focusTracker = new FocusTracker();
  readonly tabPath = new TabPathRecorder();

  enable(): void {
    this.enabled = true;
    this.focusTracker.start();
  }

  disable(): void {
    this.enabled = false;
    this.focusTracker.stop();
    this.tabPath.reset();
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}
