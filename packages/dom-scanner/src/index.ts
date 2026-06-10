/**
 * @keywise/dom-scanner
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
} from "@keywise/shared-types";
import { RULES, evaluateRules, type RuleContext } from "@keywise/wcag-rules";

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
