/**
 * @keywise/dom-scanner
 *
 * Phase 0A: READ-ONLY DOM inspection placeholders. These functions establish
 * the API surface the keyboard engine and report generator will depend on.
 *
 * Important: nothing here mutates the page. Runtime inspection can help users
 * understand keyboard accessibility, but it cannot guarantee legal compliance
 * and must never silently rewrite the page under inspection.
 */
import type { ScanRequest, ScanResult } from "@keywise/shared-types";

/** Context shared across a single scan pass. */
export interface ScanContext {
  doc: Document;
  startedAt: number;
  options: ScanRequest["options"];
}

/**
 * Create a scan context bound to a document. Defaults to the ambient
 * `document` when one is not supplied (browser content-script use).
 */
export function createScanContext(
  request: ScanRequest,
  doc: Document = globalThis.document,
): ScanContext {
  return {
    doc,
    // Caller stamps the time; kept simple and deterministic in Phase 0A.
    startedAt: 0,
    options: request.options,
  };
}

/**
 * Collect candidate focusable elements.
 * Phase 0A: returns an empty list (no traversal implemented yet).
 */
export function collectFocusableElements(_ctx: ScanContext): Element[] {
  return [];
}

/**
 * Produce a short, human-readable preview of an element for issue lists.
 * Phase 0A: minimal tag-name preview only.
 */
export function getElementPreview(el: Element | null): string {
  if (!el) return "(none)";
  const tag = el.tagName.toLowerCase();
  const text = (el.textContent ?? "").trim().slice(0, 40);
  return text ? `<${tag}> ${text}` : `<${tag}>`;
}

/**
 * Compute a reasonably stable CSS selector for an element.
 * Phase 0A: returns the lowercased tag name as a placeholder.
 */
export function getStableSelector(el: Element | null): string {
  if (!el) return "";
  if (el.id) return `#${el.id}`;
  return el.tagName.toLowerCase();
}

/**
 * Scan a document and return a valid — but empty — placeholder ScanResult.
 * No real analysis is performed in Phase 0A; `placeholder` is always true.
 */
export function scanDocument(request: ScanRequest, doc?: Document): ScanResult {
  const ctx = createScanContext(request, doc);
  const focusable = collectFocusableElements(ctx);

  return {
    requestId: request.requestId,
    url: request.url,
    timestamp: 0,
    issues: [],
    stats: {
      focusableElements: focusable.length,
      issues: 0,
      durationMs: 0,
    },
    placeholder: true,
  };
}
