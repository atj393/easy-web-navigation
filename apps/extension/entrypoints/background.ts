import { defineBackground, browser } from "#imports";
import type { ExtensionMessage } from "@keywise/shared-types";

/**
 * Background service worker (MV3).
 *
 * Phase 0A: orchestration only. It does NOT touch the DOM, make network
 * requests, or perform analysis. Its sole job is to route typed messages
 * between the popup/options surfaces and the content script.
 */
export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
    switch (message.type) {
      case "PING": {
        const reply: ExtensionMessage = { type: "PONG" };
        sendResponse(reply);
        break;
      }
      // SCAN_REQUEST / SCAN_RESULT / FOCUS_HELPER_TOGGLE / SETTINGS_UPDATED
      // will be orchestrated here in later phases. No handling in Phase 0A.
      default:
        break;
    }
    // Returning false: no async response is kept open in Phase 0A.
    return false;
  });
});
