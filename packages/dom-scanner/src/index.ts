/**
 * @easy-web-navigation/dom-scanner
 *
 * Real, READ-ONLY DOM inspection. Builds a RuleContext (DOM helpers + open
 * shadow-aware querying), runs the WCAG keyboard-profile rules, and returns a
 * structured ScanResult.
 *
 * Hard guarantees for Phase 0B:
 *  - Nothing here mutates the page (no attributes set, no nodes inserted, no
 *    listeners attached). Runtime inspection helps users understand keyboard
 *    accessibility; it cannot guarantee legal compliance.
 *  - Defensive throughout: unusual or detached elements must never throw.
 */
import {
  RULE_CATEGORIES,
  SEVERITY_ORDER,
  type IssueSeverity,
  type RuleCategory,
  type ScanOptions,
  type ScanResult,
  type ScanSummary,
} from "@easy-web-navigation/shared-types";
import { RULES, evaluateRules, type RuleContext } from "@easy-web-navigation/wcag-rules";

export const PROFILE = "WCAG 2.2 Keyboard & Navigation Profile (Level A/AA)";

/** Elements that are never relevant to inspect. */
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEMPLATE", "NOSCRIPT"]);

/**
 * The extension's own visual overlay container. It must never appear in a scan
 * or in the computed keyboard path: the tool measures the page, not itself.
 * The overlay carries no focusable content today, so this is belt-and-braces —
 * but it also stops the deep query descending into the overlay's shadow root
 * on every scan, which on a page with a full keyboard path is real work.
 */
const OWN_OVERLAY_ATTR = "data-easy-web-navigation-overlay";

/** Selector for natively keyboard-focusable elements (excluding tabindex). */
const NATURAL_FOCUSABLE = [
  "a[href]",
  "button",
  'input:not([type="hidden"])',
  "select",
  "textarea",
  "summary",
  "iframe",
  "audio[controls]",
  "video[controls]",
  '[contenteditable="true"]',
  '[contenteditable=""]',
].join(", ");

/** Candidates worth considering for focusability (natural + anything with tabindex). */
const FOCUSABLE_CANDIDATES = `${NATURAL_FOCUSABLE}, [tabindex]`;

/**
 * Per-pass memoisation.
 *
 * A scan is a single synchronous read of a DOM that cannot change underneath
 * it, so every derived fact is stable for the duration. Without this the
 * keyboard-path filter re-resolved computed styles for every ancestor of every
 * candidate — on a page with a few hundred controls that is tens of thousands
 * of `getComputedStyle` calls, each one a potential style recalculation.
 */
interface ScanCaches {
  style: WeakMap<Element, CSSStyleDeclaration | null>;
  hidden: WeakMap<Element, boolean>;
  layoutAvailable?: boolean;
}

/** Context shared across a single scan pass. */
export interface ScanContext {
  doc: Document;
  view: (Window & typeof globalThis) | null;
  options: Required<Pick<ScanOptions, "traverseShadow" | "includeHidden">>;
  /** Internal memo cache; never part of a scan's observable result. */
  caches: ScanCaches;
}

function getDefaultDocument(): Document {
  // `document` may be undefined in non-DOM environments; callers should pass one.
  return globalThis.document as Document;
}

/** Create a scan context bound to a document. */
export function createScanContext(
  doc: Document = getDefaultDocument(),
  options: ScanOptions = {},
): ScanContext {
  let view: (Window & typeof globalThis) | null = null;
  try {
    view = (doc?.defaultView as (Window & typeof globalThis) | null) ?? null;
  } catch {
    view = null;
  }
  return {
    doc,
    view,
    options: {
      traverseShadow: options.traverseShadow !== false,
      includeHidden: options.includeHidden === true,
    },
    caches: { style: new WeakMap(), hidden: new WeakMap() },
  };
}

/** Safe computed-style lookup; returns null when layout info is unavailable. */
function computedStyle(ctx: ScanContext, el: Element): CSSStyleDeclaration | null {
  const cached = ctx.caches?.style.get(el);
  if (cached !== undefined) return cached;
  let style: CSSStyleDeclaration | null = null;
  try {
    const view = ctx.view ?? (el.ownerDocument?.defaultView as Window | null);
    style = view?.getComputedStyle ? view.getComputedStyle(el) : null;
  } catch {
    style = null;
  }
  ctx.caches?.style.set(el, style);
  return style;
}

/**
 * Open shadow-aware querySelectorAll starting at the document root.
 * Closed shadow roots and cross-origin iframes are intentionally not traversed.
 */
/** Whether an element belongs to the extension's own overlay. */
function isOwnOverlay(el: Element): boolean {
  try {
    return el.hasAttribute(OWN_OVERLAY_ATTR) || !!el.closest(`[${OWN_OVERLAY_ATTR}]`);
  } catch {
    return false;
  }
}

export function deepQuery(ctx: ScanContext, selector: string): Element[] {
  const results: Element[] = [];
  const seen = new Set<Element>();

  const collectFrom = (root: ParentNode): void => {
    let matches: Element[] = [];
    try {
      matches = Array.from(root.querySelectorAll(selector));
    } catch {
      matches = [];
    }
    for (const el of matches) {
      if (SKIP_TAGS.has(el.tagName)) continue;
      if (isOwnOverlay(el)) continue;
      if (!seen.has(el)) {
        seen.add(el);
        results.push(el);
      }
    }

    if (!ctx.options.traverseShadow) return;
    let all: Element[] = [];
    try {
      all = Array.from(root.querySelectorAll("*"));
    } catch {
      all = [];
    }
    for (const el of all) {
      if (el.hasAttribute(OWN_OVERLAY_ATTR)) continue;
      const shadow = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
      if (shadow) collectFrom(shadow);
    }
  };

  if (ctx.doc) collectFrom(ctx.doc);
  return results;
}

/** Elements for which the `disabled` content attribute is actually meaningful. */
const DISABLEABLE = new Set([
  "BUTTON",
  "INPUT",
  "SELECT",
  "TEXTAREA",
  "FIELDSET",
  "OPTGROUP",
  "OPTION",
]);

function isDisabled(el: Element): boolean {
  // `disabled` on, say, a <div> is inert markup, not a disabled control.
  if (DISABLEABLE.has(el.tagName) && el.hasAttribute("disabled")) return true;
  try {
    if (DISABLEABLE.has(el.tagName) && el.closest("fieldset[disabled]")) return true;
  } catch {
    /* closest may be unavailable on exotic nodes */
  }
  return false;
}

/**
 * Whether an element is presented to users as unavailable — either natively
 * disabled or marked `aria-disabled="true"`. A control in this state is
 * deliberately not in the tab order, so it must not be reported as an element
 * that "cannot be reached by keyboard".
 */
export function isDisabledForUsers(el: Element): boolean {
  if (isDisabled(el)) return true;
  try {
    if (el.getAttribute("aria-disabled") === "true") return true;
    return !!el.closest('[aria-disabled="true"]');
  } catch {
    return false;
  }
}

/** Whether an element sits inside an `inert` subtree. */
export function isInertElement(el: Element): boolean {
  try {
    return !!el.closest("[inert]");
  } catch {
    return false;
  }
}

/**
 * The next element up the visual containment chain, stepping OUT of an open
 * shadow root to its host when the top of that tree is reached. Without this a
 * control inside a shadow root whose host is `display: none` looks visible.
 */
function visualParent(el: Element): Element | null {
  if (el.parentElement) return el.parentElement;
  try {
    const root = el.getRootNode?.();
    const host = (root as ShadowRoot | undefined)?.host;
    return host instanceof Element ? host : null;
  } catch {
    return null;
  }
}

/** Whether an element is reasonably detectable as hidden. */
export function isHidden(ctx: ScanContext, el: Element): boolean {
  const cached = ctx.caches?.hidden.get(el);
  if (cached !== undefined) return cached;
  const result = computeHidden(ctx, el);
  ctx.caches?.hidden.set(el, result);
  return result;
}

function computeHidden(ctx: ScanContext, el: Element): boolean {
  if ((el as HTMLInputElement).type === "hidden") return true;
  let node: Element | null = el;
  let depth = 0;
  while (node && node.nodeType === 1 && depth < 200) {
    if (node.hasAttribute("hidden")) return true;
    if (node.getAttribute("aria-hidden") === "true") return true;
    const style = computedStyle(ctx, node);
    if (style) {
      if (style.display === "none") return true;
      if (style.visibility === "hidden" || style.visibility === "collapse") return true;
    }
    node = visualParent(node);
    depth += 1;
  }
  return false;
}

function isVisible(ctx: ScanContext, el: Element): boolean {
  if (ctx.options.includeHidden) return true;
  return !isHidden(ctx, el);
}

/** Whether an element is reachable in the keyboard tab order. */
export function isFocusable(ctx: ScanContext, el: Element): boolean {
  if (isHidden(ctx, el)) return false;
  if (isDisabled(el)) return false;

  const tabindexAttr = el.getAttribute("tabindex");
  if (tabindexAttr !== null) {
    const value = Number.parseInt(tabindexAttr, 10);
    // A valid value decides focusability outright. An INVALID one (tabindex="")
    // is ignored per the HTML spec, so fall through to natural focusability:
    // <button tabindex="abc"> is still a focusable button.
    if (!Number.isNaN(value)) return value >= 0;
  }

  try {
    return el.matches(NATURAL_FOCUSABLE);
  } catch {
    return false;
  }
}

/** Collect visible, enabled, keyboard-focusable elements. */
export function collectFocusableElements(ctx: ScanContext): Element[] {
  return deepQuery(ctx, FOCUSABLE_CANDIDATES).filter((el) => isFocusable(ctx, el));
}

/* -------------------------------------------------------------------------
 * Visual availability for keyboard-path markers (read-only).
 *
 * A control can be in the sequential tab order yet be invisible to a sighted
 * user — e.g. a collapsed sidebar/drawer that stays in the DOM while being
 * inert, content-visibility:hidden, zero-sized, clipped by an overflow
 * ancestor, or translated fully off-canvas. The keyboard-path overlay should
 * not draw markers for such controls. This is a stricter VISUAL test than
 * `isFocusable`; the scanner's focusability semantics are intentionally left
 * unchanged. Everything here is site-independent (no class/id/text/product
 * heuristics) and never mutates the page.
 *
 * The pure geometry helpers below take plain rectangles so they can be
 * unit-tested with mocked values; the element-level checks only run them when
 * real layout measurements are available.
 * ------------------------------------------------------------------------- */

/** A minimal, comparable rectangle (subset of DOMRect). */
export interface VisRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

/** True when a rectangle has at least `min` px of rendered area on both axes. */
export function hasMeaningfulSize(rect: VisRect, min = 1): boolean {
  return rect.width >= min && rect.height >= min;
}

/**
 * True when a rectangle is entirely to the left of, or entirely to the right
 * of, the visible browser area — the off-canvas drawer/sidebar pattern. Only
 * the HORIZONTAL axis is considered; vertical off-viewport is never excluded
 * (a normal long page has valid controls above/below the fold). Returns false
 * when the viewport width is unknown (non-positive).
 */
export function isFullyOffCanvasHorizontally(rect: VisRect, viewportWidth: number): boolean {
  if (!(viewportWidth > 0)) return false;
  return rect.right <= 0 || rect.left >= viewportWidth;
}

/**
 * True when `target` has no visible intersection with a clipping ancestor's
 * box `clip`, considering only the axes the ancestor actually clips. Used to
 * detect controls hidden by a non-scrolling `overflow: hidden|clip` ancestor
 * (e.g. a width:0 collapsed panel). A partially-overlapping target returns
 * false (it stays visible).
 */
export function isClippedAwayBy(
  target: VisRect,
  clip: VisRect,
  clipsX: boolean,
  clipsY: boolean,
): boolean {
  const offX = clipsX && (target.right <= clip.left || target.left >= clip.right);
  const offY = clipsY && (target.bottom <= clip.top || target.top >= clip.bottom);
  return offX || offY;
}

/** Read `content-visibility` (computed first, inline-attribute as a fallback). */
function readContentVisibility(ctx: ScanContext, el: Element): string {
  const style = computedStyle(ctx, el);
  const computed = style?.getPropertyValue?.("content-visibility")?.trim();
  if (computed) return computed.toLowerCase();
  // Some layout-less environments do not expose content-visibility via
  // getComputedStyle; fall back to the inline style attribute.
  const inline = el.getAttribute("style") ?? "";
  const match = /content-visibility\s*:\s*([a-z-]+)/i.exec(inline);
  return match ? match[1].toLowerCase() : "";
}

/** Whether the element or an ancestor has `content-visibility: hidden`. */
function hasContentVisibilityHidden(ctx: ScanContext, el: Element): boolean {
  let node: Element | null = el;
  while (node && node.nodeType === 1) {
    if (readContentVisibility(ctx, node) === "hidden") return true;
    node = node.parentElement;
  }
  return false;
}

/** Whether real layout measurements are available (false under jsdom etc.). */
function isLayoutAvailable(ctx: ScanContext): boolean {
  if (ctx.caches && ctx.caches.layoutAvailable !== undefined) return ctx.caches.layoutAvailable;
  const result = probeLayout(ctx);
  if (ctx.caches) ctx.caches.layoutAvailable = result;
  return result;
}

function probeLayout(ctx: ScanContext): boolean {
  const probe = (el: Element | null | undefined): boolean => {
    try {
      if (!el || typeof el.getBoundingClientRect !== "function") return false;
      const r = el.getBoundingClientRect();
      return !!r && (r.width > 0 || r.height > 0);
    } catch {
      return false;
    }
  };
  return probe(ctx.doc?.documentElement) || probe(ctx.doc?.body);
}

function toVisRect(r: DOMRect): VisRect {
  return {
    left: r.left,
    right: r.right,
    top: r.top,
    bottom: r.bottom,
    width: r.width,
    height: r.height,
  };
}

/** Best-effort viewport width; 0 when unknown. */
function viewportWidth(ctx: ScanContext): number {
  try {
    const inner = ctx.view?.innerWidth;
    if (typeof inner === "number" && inner > 0) return inner;
    const client = ctx.doc?.documentElement?.clientWidth;
    return typeof client === "number" ? client : 0;
  } catch {
    return 0;
  }
}

/** html/body are never treated as clipping ancestors (they hold the page). */
const DOC_LEVEL_TAGS = new Set(["HTML", "BODY"]);

/**
 * Geometry-based unavailability: no rendered box, no meaningful size, fully
 * off-canvas horizontally, or fully clipped by a non-document overflow ancestor.
 * Only called when `isLayoutAvailable` is true.
 */
function isGeometricallyUnavailable(ctx: ScanContext, el: Element): boolean {
  let rect: DOMRect;
  let rectCount = 1;
  try {
    const rects = el.getClientRects?.();
    rectCount = rects ? rects.length : 1;
    rect = el.getBoundingClientRect();
  } catch {
    return false; // cannot measure → do not exclude
  }
  if (!rect) return false;

  const vr = toVisRect(rect);
  // No rendered client rectangles AND no box → not rendered at all.
  if (rectCount === 0 && !(vr.width > 0 || vr.height > 0)) return true;
  // No meaningful rendered size.
  if (!hasMeaningfulSize(vr)) return true;
  // Fully off-canvas horizontally (collapsed / translated drawer).
  if (isFullyOffCanvasHorizontally(vr, viewportWidth(ctx))) return true;

  // Clipped away by a non-document, non-scrolling overflow ancestor.
  let node: Element | null = el.parentElement;
  let depth = 0;
  while (node && node.nodeType === 1 && depth < 40) {
    if (!DOC_LEVEL_TAGS.has(node.tagName)) {
      const style = computedStyle(ctx, node);
      if (style) {
        const ox = (style.overflowX || style.overflow || "").trim();
        const oy = (style.overflowY || style.overflow || "").trim();
        const clipsX = ox === "hidden" || ox === "clip";
        const clipsY = oy === "hidden" || oy === "clip";
        if (clipsX || clipsY) {
          try {
            const clip = toVisRect(node.getBoundingClientRect());
            if (isClippedAwayBy(vr, clip, clipsX, clipsY)) return true;
          } catch {
            /* unmeasurable ancestor — ignore this level */
          }
        }
      }
    }
    node = node.parentElement;
    depth += 1;
  }
  return false;
}

/**
 * Whether an element should receive a keyboard-path marker. Stricter than
 * `isFocusable`: it removes tab-order controls that are not actually visible to
 * a sighted user (hidden/aria-hidden/display:none/visibility, disabled, inert,
 * content-visibility:hidden, zero-size, clipped, or fully off-canvas).
 *
 * Deliberately NEVER excludes a control for being vertically above/below the
 * viewport, nor for `opacity: 0` alone. Geometry checks run only when real
 * layout is available, so layout-less environments fall back to DOM/style
 * signals instead of hiding everything. Read-only; never throws on exotic or
 * detached nodes (defaults to keeping the control).
 */
export function isVisuallyAvailableForKeyboardPath(ctx: ScanContext, el: Element): boolean {
  try {
    if (isHidden(ctx, el)) return false;
    if (isDisabled(el)) return false;
    if (isInertElement(el)) return false;
    if (hasContentVisibilityHidden(ctx, el)) return false;
    if (isLayoutAvailable(ctx) && isGeometricallyUnavailable(ctx, el)) return false;
    return true;
  } catch {
    return true;
  }
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Escape a value for use inside an attribute selector. */
function escapeAttrValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

const VALID_ID = /^[A-Za-z][\w-]*$/;

function isUniqueId(el: Element, id: string): boolean {
  if (!VALID_ID.test(id)) return false;
  try {
    return el.ownerDocument?.querySelectorAll(`#${id}`).length === 1;
  } catch {
    return false;
  }
}

function nthOfTypeSegment(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const parent = el.parentElement;
  if (!parent) return tag;
  const sameType = Array.from(parent.children).filter((c) => c.tagName === el.tagName);
  if (sameType.length <= 1) return tag;
  const index = sameType.indexOf(el) + 1;
  return `${tag}:nth-of-type(${index})`;
}

/**
 * Compute a reasonably stable, readable CSS selector for an element.
 * Prefers a unique id, then a few useful attributes, then a tag/nth-of-type path.
 */
export function getStableSelector(el: Element | null): string {
  if (!el || el.nodeType !== 1 || !el.tagName) return "";

  if (el.id && isUniqueId(el, el.id)) return `#${el.id}`;

  const tag = el.tagName.toLowerCase();
  for (const attr of ["data-testid", "data-test", "name", "aria-label"]) {
    const value = el.getAttribute(attr);
    if (!value) continue;
    const candidate = `${tag}[${attr}="${escapeAttrValue(value)}"]`;
    try {
      if (el.ownerDocument?.querySelectorAll(candidate).length === 1) return candidate;
    } catch {
      /* invalid selector — fall through to path */
    }
  }

  const segments: string[] = [];
  let node: Element | null = el;
  let depth = 0;
  while (node && node.nodeType === 1 && depth < 12) {
    if (node.id && isUniqueId(node, node.id)) {
      segments.unshift(`#${node.id}`);
      break;
    }
    segments.unshift(nthOfTypeSegment(node));
    node = node.parentElement;
    depth += 1;
  }
  return segments.join(" > ");
}

const PREVIEW_ATTRS = ["id", "type", "name", "role", "href", "aria-label", "placeholder", "class"];
const MAX_PREVIEW = 140;
const VOID_TAGS = new Set(["input", "img", "br", "hr", "area", "source", "track"]);

/** Produce a short, sanitized HTML-ish preview of an element. */
export function getElementPreview(el: Element | null): string {
  if (!el || el.nodeType !== 1 || !el.tagName) return "(none)";
  const tag = el.tagName.toLowerCase();

  const attrParts: string[] = [];
  for (const name of PREVIEW_ATTRS) {
    const value = el.getAttribute(name);
    if (value == null) continue;
    const trimmed = collapseWhitespace(value).slice(0, 40);
    attrParts.push(trimmed ? `${name}="${trimmed}"` : name);
  }
  const attrs = attrParts.length ? " " + attrParts.join(" ") : "";

  if (VOID_TAGS.has(tag)) {
    return `<${tag}${attrs}>`.slice(0, MAX_PREVIEW);
  }

  const text = collapseWhitespace(el.textContent ?? "").slice(0, 40);
  return `<${tag}${attrs}>${text}</${tag}>`.slice(0, MAX_PREVIEW);
}

function textFromIds(ctx: ScanContext, ids: string): string {
  const parts: string[] = [];
  for (const id of ids.split(/\s+/).filter(Boolean)) {
    const ref = ctx.doc.getElementById(id);
    if (ref) parts.push(ref.textContent ?? "");
  }
  return collapseWhitespace(parts.join(" "));
}

/** Text of a wrapping <label>, with the labelled control's own subtree removed. */
function labelTextExcluding(label: Element, control: Element): string {
  const parts: string[] = [];
  const walk = (node: Node): void => {
    if (node === control) return;
    if (node.nodeType === 3) {
      parts.push(node.textContent ?? "");
      return;
    }
    if (node.nodeType !== 1) return;
    if (SKIP_TAGS.has((node as Element).tagName)) return;
    for (const child of Array.from(node.childNodes)) walk(child);
  };
  try {
    for (const child of Array.from(label.childNodes)) walk(child);
  } catch {
    return "";
  }
  return collapseWhitespace(parts.join(" "));
}

/**
 * Elements whose accessible name is NEVER taken from their contents.
 *
 * A <select>'s options and a <textarea>'s value are its VALUE, not its name;
 * treating them as a name made every unlabeled dropdown with options look
 * correctly labeled. See the "name from content" rule in the accname spec.
 */
const NAME_NEVER_FROM_CONTENT = new Set(["SELECT", "TEXTAREA", "INPUT", "PROGRESS", "METER"]);

/**
 * Text of an element's subtree for accessible-name purposes.
 *
 * Two differences from `textContent`, both from the accname algorithm:
 *  - an `aria-hidden="true"` subtree contributes nothing, so a decorative glyph
 *    cannot stand in for a real name;
 *  - a descendant that carries its own `aria-label` (or `alt`) contributes that
 *    label, which is how `<button><svg aria-label="Close"></svg></button>` —
 *    the ordinary icon-button pattern — gets its name.
 */
function nameFromContent(el: Element, depth = 0): string {
  if (depth > 20) return "";
  const parts: string[] = [];
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === 3) {
      parts.push(node.textContent ?? "");
      continue;
    }
    if (node.nodeType !== 1) continue;
    const child = node as Element;
    if (SKIP_TAGS.has(child.tagName)) continue;
    if (child.getAttribute("aria-hidden") === "true") continue;

    const label = child.getAttribute("aria-label");
    if (label && label.trim()) {
      parts.push(label.trim());
      continue;
    }
    const alt = child.getAttribute("alt");
    if (alt !== null) {
      // An explicitly empty alt marks the image decorative: it adds nothing.
      if (alt.trim()) parts.push(alt.trim());
      continue;
    }
    if (child.tagName === "SVG" || child.tagName === "svg") {
      const title = collapseWhitespace(child.querySelector("title")?.textContent ?? "");
      if (title) parts.push(title);
      continue;
    }
    parts.push(nameFromContent(child, depth + 1));
  }
  return collapseWhitespace(parts.join(" "));
}

/**
 * Best-effort accessible name. A pragmatic subset of the ARIA accname
 * algorithm covering the cases these rules rely on.
 */
export function getAccessibleName(ctx: ScanContext, el: Element): string {
  // 1. aria-labelledby
  const labelledby = el.getAttribute("aria-labelledby");
  if (labelledby) {
    const text = textFromIds(ctx, labelledby);
    if (text) return text;
  }

  // 2. aria-label
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();

  const tag = el.tagName.toLowerCase();
  const type = (el.getAttribute("type") ?? "").toLowerCase();

  // 3. native strategies
  if (tag === "input" || tag === "select" || tag === "textarea") {
    if (el.id) {
      try {
        const forLabel = ctx.doc.querySelector(`label[for="${escapeAttrValue(el.id)}"]`);
        const text = collapseWhitespace(forLabel?.textContent ?? "");
        if (text) return text;
      } catch {
        /* ignore invalid selector */
      }
    }
    const wrapping = el.closest("label");
    if (wrapping) {
      // The control's own contents are its value, not its label: a <select>
      // wrapped in a bare <label> is unlabeled even though the label's
      // textContent contains the option text.
      const text = labelTextExcluding(wrapping, el);
      if (text) return text;
    }
    if (tag === "input") {
      if (type === "submit" || type === "reset" || type === "button") {
        const value = el.getAttribute("value");
        if (value && value.trim()) return value.trim();
        // Submit/reset buttons have implicit default labels.
        if (type === "submit") return "Submit";
        if (type === "reset") return "Reset";
      }
      if (type === "image") {
        const alt = el.getAttribute("alt");
        if (alt && alt.trim()) return alt.trim();
      }
    }
  }

  if (tag === "img") {
    const alt = el.getAttribute("alt");
    if (alt && alt.trim()) return alt.trim();
  }

  // Name from content — but only for roles that actually take one. A dropdown
  // is not named by its options, and a textarea is not named by its value.
  if (!NAME_NEVER_FROM_CONTENT.has(el.tagName)) {
    try {
      const text = nameFromContent(el);
      if (text) return text;
    } catch {
      /* exotic subtree — fall through to the title attribute */
    }
  }

  // 4. title (weak fallback)
  const title = el.getAttribute("title");
  if (title && title.trim()) return title.trim();

  return "";
}

/** Wrap a ScanContext as the DOM-agnostic RuleContext the rules consume. */
export function createRuleContext(ctx: ScanContext): RuleContext {
  return {
    document: ctx.doc,
    query: (selector) => deepQuery(ctx, selector),
    isVisible: (el) => isVisible(ctx, el),
    isFocusable: (el) => isFocusable(ctx, el),
    isDisabled: (el) => isDisabledForUsers(el),
    isInert: (el) => isInertElement(el),
    getAccessibleName: (el) => getAccessibleName(ctx, el),
    getStableSelector: (el) => getStableSelector(el),
    getElementPreview: (el) => getElementPreview(el),
  };
}

function emptySeverityCounts(): Record<IssueSeverity, number> {
  return SEVERITY_ORDER.reduce(
    (acc, s) => {
      acc[s] = 0;
      return acc;
    },
    {} as Record<IssueSeverity, number>,
  );
}

function emptyCategoryCounts(): Record<RuleCategory, number> {
  return RULE_CATEGORIES.reduce(
    (acc, c) => {
      acc[c] = 0;
      return acc;
    },
    {} as Record<RuleCategory, number>,
  );
}

function summarize(issues: ScanResult["issues"]): ScanSummary {
  const bySeverity = emptySeverityCounts();
  const byCategory = emptyCategoryCounts();
  const byRule: Record<string, number> = {};

  for (const issue of issues) {
    bySeverity[issue.severity] += 1;
    byRule[issue.ruleId] = (byRule[issue.ruleId] ?? 0) + 1;
    const category = RULES[issue.ruleId as keyof typeof RULES]?.category;
    if (category) byCategory[category] += 1;
  }

  return { total: issues.length, bySeverity, byCategory, byRule };
}

function safeUrl(doc: Document): string {
  try {
    return doc.URL ?? doc.location?.href ?? "";
  } catch {
    return "";
  }
}

function safeTitle(doc: Document): string {
  try {
    return doc.title ?? "";
  } catch {
    return "";
  }
}

/**
 * Scan a document (read-only) and return a structured ScanResult.
 * Pass `now` for deterministic timestamps in tests.
 */
export function scanDocument(
  doc: Document = getDefaultDocument(),
  options: ScanOptions = {},
  now: () => number = Date.now,
): ScanResult {
  const ctx = createScanContext(doc, options);
  const focusable = collectFocusableElements(ctx);
  const ruleContext = createRuleContext(ctx);
  const issues = evaluateRules(ruleContext);

  return {
    url: safeUrl(ctx.doc),
    title: safeTitle(ctx.doc),
    scannedAt: now(),
    profile: PROFILE,
    issues,
    summary: summarize(issues),
    focusableCount: focusable.length,
  };
}
