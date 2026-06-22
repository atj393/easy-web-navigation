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
  "details",
  '[contenteditable="true"]',
  '[contenteditable=""]',
].join(", ");

/** Candidates worth considering for focusability (natural + anything with tabindex). */
const FOCUSABLE_CANDIDATES = `${NATURAL_FOCUSABLE}, [tabindex]`;

/** Context shared across a single scan pass. */
export interface ScanContext {
  doc: Document;
  view: (Window & typeof globalThis) | null;
  options: Required<Pick<ScanOptions, "traverseShadow" | "includeHidden">>;
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
  };
}

/** Safe computed-style lookup; returns null when layout info is unavailable. */
function computedStyle(ctx: ScanContext, el: Element): CSSStyleDeclaration | null {
  try {
    const view = ctx.view ?? (el.ownerDocument?.defaultView as Window | null);
    return view?.getComputedStyle ? view.getComputedStyle(el) : null;
  } catch {
    return null;
  }
}

/**
 * Open shadow-aware querySelectorAll starting at the document root.
 * Closed shadow roots and cross-origin iframes are intentionally not traversed.
 */
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
      const shadow = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
      if (shadow) collectFrom(shadow);
    }
  };

  if (ctx.doc) collectFrom(ctx.doc);
  return results;
}

function isDisabled(el: Element): boolean {
  if (el.hasAttribute("disabled")) return true;
  try {
    if (el.closest("fieldset[disabled]")) return true;
  } catch {
    /* closest may be unavailable on exotic nodes */
  }
  return false;
}

/** Whether an element is reasonably detectable as hidden. */
export function isHidden(ctx: ScanContext, el: Element): boolean {
  if ((el as HTMLInputElement).type === "hidden") return true;
  let node: Element | null = el;
  while (node && node.nodeType === 1) {
    if (node.hasAttribute("hidden")) return true;
    if (node.getAttribute("aria-hidden") === "true") return true;
    const style = computedStyle(ctx, node);
    if (style) {
      if (style.display === "none") return true;
      if (style.visibility === "hidden" || style.visibility === "collapse") return true;
    }
    node = node.parentElement;
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
    return !Number.isNaN(value) && value >= 0;
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

/** Whether an element is inside an inert subtree. */
function isInert(el: Element): boolean {
  try {
    return !!el.closest("[inert]");
  } catch {
    return false;
  }
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
    if (isInert(el)) return false;
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

/**
 * Best-effort accessible name. A pragmatic subset of the ARIA accname
 * algorithm covering the cases the Phase 0B rules rely on.
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
      const text = collapseWhitespace(wrapping.textContent ?? "");
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

  // Text content for buttons/links and other elements.
  const text = collapseWhitespace(el.textContent ?? "");
  if (text) return text;

  // Nested image alt / inline SVG title.
  try {
    const img = el.querySelector("img[alt]");
    const alt = collapseWhitespace(img?.getAttribute("alt") ?? "");
    if (alt) return alt;
    const svgTitle = collapseWhitespace(el.querySelector("svg title")?.textContent ?? "");
    if (svgTitle) return svgTitle;
  } catch {
    /* ignore */
  }

  if (tag === "img") {
    const alt = el.getAttribute("alt");
    if (alt && alt.trim()) return alt.trim();
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
