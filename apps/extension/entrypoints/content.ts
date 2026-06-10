import { defineContentScript, browser } from "#imports";
import { scanDocument } from "@easy-web-navigation/dom-scanner";
import { computeTabPath } from "@easy-web-navigation/keyboard-engine";
import { FocusOverlayController } from "@easy-web-navigation/focus-overlay";
import type { ExtensionMessage, TabPathSummary } from "@easy-web-navigation/shared-types";

/**
 * Content script.
 *
 * Registered at RUNTIME (not in the manifest) so Easy Web Navigation does not request
 * broad <all_urls> host permissions. It is injected into the active tab on
 * demand via activeTab + scripting.
 *
 * Phase 0C/0D: in addition to the read-only scan, this script owns a single
 * extension-owned visual overlay (focus helper, issue locator, and tab-path
 * markers). It still does NOT modify any inspected page node — the only DOM it
 * creates is its own isolated overlay container, fully removed when unused.
 *
 * IMPORTANT — inspection vs. compliance: runtime inspection helps users
 * UNDERSTAND keyboard accessibility; it cannot GUARANTEE legal compliance with
 * WCAG, BITV, EN 301 549, EAA, ADA, or Section 508.
 */

const LOCATE_DURATION_MS = 2000;

export default defineContentScript({
  matches: ["<all_urls>"],
  registration: "runtime",
  main() {
    // Safe initialization guard: never attach listeners twice.
    const FLAG = "__easyWebNavigationInitialized";
    const w = window as unknown as Record<string, boolean>;
    if (w[FLAG]) return;
    w[FLAG] = true;

    const overlay = new FocusOverlayController({ doc: document });
    let focusHelperEnabled = false;
    let tabPathEnabled = false;
    let lastTabSummary: TabPathSummary | null = null;

    // Read-only focus tracking. Capture phase so it still fires for targets
    // that stop propagation. We never call focus() or preventDefault().
    const onFocusIn = (event: FocusEvent): void => {
      const target = event.target;
      if (target instanceof Element) overlay.updateForElement(target);
    };

    function enableFocusHelper(): void {
      if (focusHelperEnabled) return;
      focusHelperEnabled = true;
      overlay.mount();
      document.addEventListener("focusin", onFocusIn, true);
      // Reflect the element that already has focus, if any.
      const active = document.activeElement;
      if (active && active !== document.body) overlay.updateForElement(active);
    }

    function disableFocusHelper(): void {
      if (!focusHelperEnabled) return;
      focusHelperEnabled = false;
      document.removeEventListener("focusin", onFocusIn, true);
      overlay.clearHighlight("focus");
      // Keep the overlay mounted if the tab path (or anything else) still needs it.
      if (!tabPathEnabled && !overlay.hasContent()) overlay.unmount();
    }

    function enableTabPath(options?: { maxItems?: number }): TabPathSummary {
      const { summary, elements } = computeTabPath(document, options);
      overlay.showTabPath(elements);
      tabPathEnabled = true;
      lastTabSummary = summary;
      return summary;
    }

    function disableTabPath(): void {
      tabPathEnabled = false;
      lastTabSummary = null;
      overlay.clearTabPath();
      if (!focusHelperEnabled && !overlay.hasContent()) overlay.unmount();
    }

    /** Best-effort selector resolution (light shadow-DOM fallback). */
    function findBySelector(selector: string): Element | null {
      try {
        const direct = document.querySelector(selector);
        if (direct) return direct;
      } catch {
        return null;
      }
      // Fallback: search open shadow roots one level deep.
      for (const host of Array.from(document.querySelectorAll("*"))) {
        const shadow = (host as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (!shadow) continue;
        try {
          const match = shadow.querySelector(selector);
          if (match) return match;
        } catch {
          /* ignore invalid selector in this root */
        }
      }
      return null;
    }

    function locateIssue(selector: string): boolean {
      const element = findBySelector(selector);
      if (!element) return false;
      try {
        element.scrollIntoView({ block: "center", inline: "nearest" });
      } catch {
        /* scrollIntoView may be unavailable; highlight anyway */
      }
      overlay.highlightElement(element, {
        id: "locate",
        type: "locate",
        durationMs: LOCATE_DURATION_MS,
      });
      return true;
    }

    browser.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
      switch (message.type) {
        case "SCAN_REQUEST": {
          try {
            const result = scanDocument(document, message.payload?.options);
            sendResponse({ type: "SCAN_RESULT", payload: result } satisfies ExtensionMessage);
          } catch (error) {
            sendResponse({
              type: "SCAN_ERROR",
              payload: { message: error instanceof Error ? error.message : String(error) },
            } satisfies ExtensionMessage);
          }
          return false;
        }
        case "TOGGLE_FOCUS_HELPER": {
          if (message.payload.enabled) enableFocusHelper();
          else disableFocusHelper();
          sendResponse({
            type: "FOCUS_HELPER_STATE",
            payload: { enabled: focusHelperEnabled },
          } satisfies ExtensionMessage);
          return false;
        }
        case "GET_FOCUS_HELPER_STATE": {
          sendResponse({
            type: "FOCUS_HELPER_STATE",
            payload: { enabled: focusHelperEnabled },
          } satisfies ExtensionMessage);
          return false;
        }
        case "LOCATE_ISSUE": {
          const found = locateIssue(message.payload.selector);
          sendResponse({ type: "LOCATE_RESULT", payload: { found } } satisfies ExtensionMessage);
          return false;
        }
        case "TOGGLE_TAB_PATH": {
          let summary: TabPathSummary | null = null;
          try {
            if (message.payload.enabled) summary = enableTabPath(message.payload.options);
            else disableTabPath();
          } catch {
            // Defensive: never let a computation error break the page.
            disableTabPath();
          }
          sendResponse({
            type: "TAB_PATH_RESULT",
            payload: { enabled: tabPathEnabled, summary },
          } satisfies ExtensionMessage);
          return false;
        }
        case "GET_TAB_PATH_STATE": {
          sendResponse({
            type: "TAB_PATH_RESULT",
            payload: { enabled: tabPathEnabled, summary: lastTabSummary },
          } satisfies ExtensionMessage);
          return false;
        }
        default:
          return false;
      }
    });
  },
});
