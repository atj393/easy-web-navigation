import { defineContentScript, browser } from "#imports";
import { scanDocument } from "@keywise/dom-scanner";
import { FocusOverlayController } from "@keywise/focus-overlay";
import type { ExtensionMessage } from "@keywise/shared-types";

/**
 * Content script.
 *
 * Registered at RUNTIME (not in the manifest) so KeyWise Web does not request
 * broad <all_urls> host permissions. It is injected into the active tab on
 * demand via activeTab + scripting.
 *
 * Phase 0C: in addition to the read-only scan, this script owns a single
 * extension-owned visual overlay (the focus helper / issue locator). It still
 * does NOT modify any inspected page node — the only DOM it creates is its own
 * isolated overlay container, which is fully removed when the helper is off.
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
    const FLAG = "__keywiseWebInitialized";
    const w = window as unknown as Record<string, boolean>;
    if (w[FLAG]) return;
    w[FLAG] = true;

    const overlay = new FocusOverlayController({ doc: document });
    let focusHelperEnabled = false;

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
      overlay.unmount();
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
        default:
          return false;
      }
    });
  },
});
