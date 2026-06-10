import { defineContentScript, browser } from "#imports";
import { scanDocument } from "@keywise/dom-scanner";
import type { ExtensionMessage, ScanRequest } from "@keywise/shared-types";

/**
 * Content script.
 *
 * Registered at RUNTIME (not in the manifest) so KeyWise Web does not request
 * broad <all_urls> host permissions in Phase 0A. It is injected into the
 * active tab on demand via activeTab + scripting.
 *
 * IMPORTANT — inspection vs. compliance:
 * Runtime DOM inspection can help users and developers UNDERSTAND keyboard
 * accessibility (focus visibility, tab order, accessible names). It cannot
 * GUARANTEE legal compliance with WCAG, BITV, EN 301 549, EAA, ADA, or
 * Section 508, and it must never silently rewrite the page it inspects.
 */
export default defineContentScript({
  matches: ["<all_urls>"],
  registration: "runtime",
  main() {
    // Safe initialization guard: never run twice in the same document.
    const FLAG = "__keywiseWebInitialized";
    const w = window as unknown as Record<string, boolean>;
    if (w[FLAG]) return;
    w[FLAG] = true;

    // --- scan request handler (placeholder) ------------------------------
    function handleScanRequest(request: ScanRequest) {
      // Phase 0A: returns a placeholder result; performs no DOM mutation.
      return scanDocument(request, document);
    }

    // --- focus tracking (placeholder) ------------------------------------
    function startFocusTracking() {
      // Phase 0A: intentionally no listeners attached. See keyboard-engine.
    }

    // --- page summary (placeholder) --------------------------------------
    function buildPageSummary() {
      // Phase 0A: read-only stub. No structural inspection implemented yet.
      return { title: document.title, url: location.href };
    }

    browser.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
      if (message.type === "SCAN_REQUEST") {
        const result = handleScanRequest(message.payload);
        const reply: ExtensionMessage = { type: "SCAN_RESULT", payload: result };
        sendResponse(reply);
      }
      return false;
    });

    // Reference the placeholders so they are part of the typed surface.
    void startFocusTracking;
    void buildPageSummary;
  },
});
