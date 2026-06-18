import { defineBackground, browser } from "#imports";
import type { ExtensionMessage } from "@easy-web-navigation/shared-types";
import { monitoringItem } from "../lib/settings";
import { isSupportedPageUrl, originPatternFromUrl } from "../lib/monitoring";

/**
 * Background service worker (MV3).
 *
 * Orchestration only. It does NOT touch the DOM, make network requests, or
 * analyze pages. Two responsibilities:
 *
 *  1. A minimal typed message router (kept for future cross-surface needs).
 *  2. Monitoring auto-injection: when the user has turned monitoring on with a
 *     `site` / `all-sites` scope AND granted the matching optional host
 *     permission, inject the read-only content script into matching tabs as the
 *     user navigates. Event-driven via `tabs.onUpdated` — no polling, no loops.
 *
 * `current-tab` / `off` scope do nothing here: activeTab cannot be exercised
 * from the background without a user gesture, so current-tab monitoring is
 * applied by the popup/content script during the session only.
 */
export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
    if (message.type === "PING") {
      sendResponse({ type: "PONG" } satisfies ExtensionMessage);
    }
    // SCAN_REQUEST / TOGGLE_* / APPLY_MONITORING are handled by the content
    // script directly; the background does not need to relay them.
    return false;
  });

  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status !== "complete") return;
    void (async () => {
      try {
        const monitoring = await monitoringItem.getValue();
        if (!monitoring.enabled) return;
        if (monitoring.scope !== "site" && monitoring.scope !== "all-sites") return;

        // `tab.url` is only populated for tabs covered by a granted host
        // permission (we deliberately avoid the broad "tabs" permission).
        if (!isSupportedPageUrl(tab.url)) return;
        const pattern = originPatternFromUrl(tab.url);
        if (!pattern) return;

        const allowed = await browser.permissions.contains({ origins: [pattern] });
        if (!allowed) return;

        // Read-only content script; it self-applies the remembered helpers.
        await browser.scripting.executeScript({
          target: { tabId },
          files: ["/content-scripts/content.js"],
        });
      } catch {
        // No permission for this tab, restricted page, or injection failed —
        // skip silently. Monitoring simply does not apply here.
      }
    })();
  });
});
