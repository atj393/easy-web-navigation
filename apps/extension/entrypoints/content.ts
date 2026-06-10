import { defineContentScript, browser } from "#imports";
import { scanDocument } from "@keywise/dom-scanner";
import type { ExtensionMessage } from "@keywise/shared-types";

/**
 * Content script.
 *
 * Registered at RUNTIME (not in the manifest) so KeyWise Web does not request
 * broad <all_urls> host permissions. It is injected into the active tab on
 * demand via activeTab + scripting when the user runs a scan.
 *
 * IMPORTANT — inspection vs. compliance:
 * Runtime DOM inspection can help users and developers UNDERSTAND keyboard
 * accessibility (focus, tab order, accessible names). It cannot GUARANTEE
 * legal compliance with WCAG, BITV, EN 301 549, EAA, ADA, or Section 508, and
 * it must never silently rewrite the page it inspects. This script is strictly
 * READ-ONLY: it does not modify the DOM in any way.
 */
export default defineContentScript({
  matches: ["<all_urls>"],
  registration: "runtime",
  main() {
    // Safe initialization guard: never attach the listener twice.
    const FLAG = "__keywiseWebInitialized";
    const w = window as unknown as Record<string, boolean>;
    if (w[FLAG]) return;
    w[FLAG] = true;

    browser.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
      if (message.type !== "SCAN_REQUEST") return false;
      try {
        // Read-only scan of the live document.
        const result = scanDocument(document, message.payload?.options);
        const reply: ExtensionMessage = { type: "SCAN_RESULT", payload: result };
        sendResponse(reply);
      } catch (error) {
        const reply: ExtensionMessage = {
          type: "SCAN_ERROR",
          payload: { message: error instanceof Error ? error.message : String(error) },
        };
        sendResponse(reply);
      }
      return false;
    });
  },
});
