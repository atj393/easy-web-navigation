import { defineContentScript, browser } from "#imports";
import { scanDocument } from "@easy-web-navigation/dom-scanner";
import { computeTabPath } from "@easy-web-navigation/keyboard-engine";
import { FocusOverlayController } from "@easy-web-navigation/focus-overlay";
import type { ExtensionMessage, TabPathSummary } from "@easy-web-navigation/shared-types";
import { monitoringItem } from "../lib/settings";
import { createSpaRouteMonitor, type SpaRouteMonitor } from "../lib/spa-monitoring";

/**
 * Content script.
 *
 * Registered at RUNTIME (not in the manifest) so Easy Web Navigation does not
 * request broad <all_urls> host permissions. It is injected into the active tab
 * on demand via activeTab + scripting, or (when monitoring is on and the user
 * granted optional host permissions) into matching tabs by the background.
 *
 * Phase 0C/0D/0G: in addition to the read-only scan, this script owns a single
 * extension-owned visual overlay (focus helper, issue locator, tab-path
 * markers). When monitoring is enabled it re-applies the remembered visual
 * helpers on load. It still does NOT modify any inspected page node — the only
 * DOM it creates is its own isolated overlay container, fully removed when
 * unused.
 *
 * IMPORTANT — inspection vs. compliance: runtime inspection helps users
 * UNDERSTAND keyboard accessibility; it cannot GUARANTEE legal compliance with
 * WCAG, BITV, EN 301 549, EAA, ADA, or Section 508. Nothing is uploaded; no
 * external APIs are called.
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
      const active = document.activeElement;
      if (active && active !== document.body) overlay.updateForElement(active);
    }

    function disableFocusHelper(): void {
      if (!focusHelperEnabled) return;
      focusHelperEnabled = false;
      document.removeEventListener("focusin", onFocusIn, true);
      overlay.clearHighlight("focus");
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

    /** Apply (or clear) the remembered visual helpers. Read-only. */
    function applyMonitoring(focusHelper: boolean, tabPath: boolean): void {
      if (focusHelper) enableFocusHelper();
      else disableFocusHelper();
      if (tabPath) enableTabPath();
      else disableTabPath();
    }

    // --- SPA route-change monitoring (only while monitoring is active) -------
    let spaMonitor: SpaRouteMonitor | null = null;

    /**
     * Re-establish overlays on the (possibly replaced) DOM after a route
     * change, re-apply whichever helpers are enabled, and run one read-only
     * scan. Tearing down first re-mounts a fresh overlay container if the SPA
     * replaced <body>. Read-only throughout.
     */
    async function refreshForRoute(): Promise<void> {
      // Use the LATEST saved preferences, not stale in-memory values.
      let wantFocus = focusHelperEnabled;
      let wantTab = tabPathEnabled;
      try {
        const monitoring = await monitoringItem.getValue();
        if (!monitoring.enabled) return; // monitoring turned off — nothing to refresh
        wantFocus = monitoring.focusHelperEnabled;
        wantTab = monitoring.tabPathEnabled;
      } catch {
        /* storage unavailable — fall back to current in-memory prefs */
      }
      applyMonitoring(false, false);
      applyMonitoring(wantFocus, wantTab);
      try {
        scanDocument(document);
      } catch {
        /* read-only auto-scan; result not stored or uploaded */
      }
    }

    function startSpaMonitor(): void {
      if (!spaMonitor) spaMonitor = createSpaRouteMonitor({ onRouteChange: refreshForRoute });
      spaMonitor.start();
    }

    function stopSpaMonitor(): void {
      spaMonitor?.stop();
    }

    /** Best-effort selector resolution (light shadow-DOM fallback). */
    function findBySelector(selector: string): Element | null {
      try {
        const direct = document.querySelector(selector);
        if (direct) return direct;
      } catch {
        return null;
      }
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
        case "APPLY_MONITORING": {
          applyMonitoring(message.payload.focusHelper, message.payload.tabPath);
          sendResponse({
            type: "MONITORING_APPLIED",
            payload: {
              focusHelper: focusHelperEnabled,
              tabPath: tabPathEnabled,
              tabPathSummary: lastTabSummary,
            },
          } satisfies ExtensionMessage);
          return false;
        }
        default:
          return false;
      }
    });

    // Monitoring auto-start: when the user has turned monitoring on, re-apply
    // the remembered visual helpers, run one read-only scan, and begin SPA
    // route monitoring. This runs only because the user explicitly enabled
    // monitoring.
    void (async () => {
      try {
        const monitoring = await monitoringItem.getValue();
        if (!monitoring.enabled) return;
        applyMonitoring(monitoring.focusHelperEnabled, monitoring.tabPathEnabled);
        scanDocument(document);
        startSpaMonitor();
      } catch {
        /* storage unavailable — monitoring simply does not auto-apply */
      }
    })();

    // React to monitoring being toggled while this page is already open:
    // enabling starts SPA monitoring (+ applies helpers); disabling stops it
    // and clears overlays. Lifecycle is driven entirely by the user's choice.
    try {
      monitoringItem.watch((next, prev) => {
        const wasEnabled = prev?.enabled ?? false;
        if (next.enabled && !wasEnabled) {
          applyMonitoring(next.focusHelperEnabled, next.tabPathEnabled);
          try {
            scanDocument(document);
          } catch {
            /* read-only */
          }
          startSpaMonitor();
        } else if (!next.enabled && wasEnabled) {
          stopSpaMonitor();
          applyMonitoring(false, false);
        }
      });
    } catch {
      /* storage watch unavailable — popup messages still drive helper state */
    }
  },
});
