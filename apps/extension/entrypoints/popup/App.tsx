import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { generateMarkdownReport } from "@easy-web-navigation/report-generator";
import { PRODUCT_NAME, type TabPathMaxItems } from "@easy-web-navigation/shared-types";
import type { MonitoringScope, MonitoringSettings } from "@easy-web-navigation/shared-types";
import { copyTextToClipboard } from "../../lib/clipboard";
import { monitoringItem } from "../../lib/settings";
import {
  createApplyMonitoringPayload,
  hostPermissionsForScope,
  isSupportedPageUrl,
  reportFileName,
  scopeNeedsPermission,
} from "../../lib/monitoring";
import { AutoPanel } from "./components/AutoPanel";
import { GuidesPanel } from "./components/GuidesPanel";
import { ResultsPanel } from "./components/ResultsPanel";
import { Tabs, tabButtonId, tabPanelId, type TabDescriptor } from "./components/Tabs";
import {
  DISCLAIMER,
  humanizeError,
  PERMISSION_DENIED_MSG,
  REPORT_PRIVACY_NOTE,
  TAGLINE,
} from "./messages";
import { ensureInjected, getActiveTab, requestOrigins, send } from "./page-actions";
import {
  canCheck,
  canReport,
  INITIAL_STATE,
  issuesForDisplay,
  normalizeMonitoringSettings,
  popupReducer,
  resultsTabCount,
  statusLine,
  type PopupTab,
} from "./state";

/**
 * Popup UI.
 *
 * Structure is a fixed shell: header (brand, status strip, primary action),
 * a tab strip, a scrolling body, and a pinned footer. The shell's dimensions
 * come from CSS constants and never depend on content, which is what keeps the
 * browser's popup autosizer still (see RB-001 and the sizing contract at the
 * top of style.css).
 *
 * All state moves through one reducer (`state.ts`) so startup is two structural
 * states — `booting` then `ready` — rather than a dozen independent async
 * `setState` calls each re-shaping the tree.
 *
 * The extension stays READ-ONLY toward inspected pages throughout: it scans,
 * and it asks the content script to draw its own isolated overlay. It never
 * mutates page nodes.
 */
export function App() {
  const [state, dispatch] = useReducer(popupReducer, INITIAL_STATE);
  const [busy, setBusy] = useState(false);

  /**
   * Race guards (§ async): the popup can be closed, or the user can start a new
   * action, while an await is still in flight. `alive` drops every update after
   * unmount; `scanSeq` makes sure only the newest check may write a result.
   */
  const alive = useRef(true);
  const scanSeq = useRef(0);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  /* ------------------------------------------------------------ startup -- */

  const runScan = useCallback(async () => {
    const seq = ++scanSeq.current;
    dispatch({ type: "SCAN_STARTED" });
    try {
      const tab = await getActiveTab();
      await ensureInjected(tab.id);
      const response = await send(tab.id, { type: "SCAN_REQUEST", payload: {} });
      // A newer check (or a closed popup) supersedes this one.
      if (!alive.current || seq !== scanSeq.current) return;
      if (!response) throw new Error("No response from the page.");
      if (response.type === "SCAN_ERROR") throw new Error(response.payload.message);
      if (response.type !== "SCAN_RESULT") throw new Error("Unexpected response from the page.");
      dispatch({ type: "SCAN_SUCCEEDED", result: response.payload });
    } catch (e) {
      if (!alive.current || seq !== scanSeq.current) return;
      dispatch({ type: "SCAN_FAILED", message: humanizeError(e) });
    }
  }, []);

  useEffect(() => {
    void (async () => {
      // Boot reads only fast, local sources — extension storage and the active
      // tab. Nothing here waits on the inspected page, so `booting` is a few
      // milliseconds and the interactive UI is committed in one go.
      let settings: MonitoringSettings;
      try {
        settings = normalizeMonitoringSettings(await monitoringItem.getValue());
      } catch {
        settings = normalizeMonitoringSettings(undefined);
      }

      let url = "";
      try {
        url = (await getActiveTab()).url;
      } catch {
        /* no active tab — the restricted/blocked state below covers it */
      }
      if (!alive.current) return;

      const blocked = isSupportedPageUrl(url) ? null : "restricted";
      dispatch({ type: "BOOTED", payload: { url, blocked, settings } });

      if (blocked) return;

      if (settings.enabled) {
        // Automatic checking is on and opening the popup is a user gesture, so
        // the read-only content script may be injected and the remembered
        // guides re-applied here — this is what makes the `current-tab` scope
        // work, where the background cannot inject on navigation.
        await runScan();
        if (!alive.current) return;
        try {
          const tab = await getActiveTab();
          const applied = await send(tab.id, {
            type: "APPLY_MONITORING",
            payload: createApplyMonitoringPayload(settings),
          });
          if (!alive.current) return;
          if (applied?.type === "MONITORING_APPLIED") {
            dispatch({
              type: "GUIDES_APPLIED",
              focusHelper: applied.payload.focusHelper,
              tabPath: applied.payload.tabPath,
              summary: applied.payload.tabPathSummary,
            });
          }
        } catch (e) {
          if (alive.current) dispatch({ type: "AUTO_FAILED", message: humanizeError(e) });
        }
        return;
      }

      // Automatic checking is off: read live guide state without injecting, so
      // opening the popup has no effect on a page the user did not ask about.
      try {
        const tab = await getActiveTab();
        const focus = await send(tab.id, { type: "GET_FOCUS_HELPER_STATE" });
        const path = await send(tab.id, { type: "GET_TAB_PATH_STATE" });
        if (!alive.current) return;
        if (focus?.type === "FOCUS_HELPER_STATE" || path?.type === "TAB_PATH_RESULT") {
          dispatch({
            type: "GUIDES_APPLIED",
            focusHelper: focus?.type === "FOCUS_HELPER_STATE" ? focus.payload.enabled : false,
            tabPath: path?.type === "TAB_PATH_RESULT" ? path.payload.enabled : false,
            summary: path?.type === "TAB_PATH_RESULT" ? path.payload.summary : null,
          });
        }
      } catch {
        // Expected: the content script has not been injected into this page
        // yet, so no guide is running. Not a user-significant failure.
      }
    })();
    // Startup runs exactly once; `runScan` is stable via useCallback.
  }, [runScan]);

  /* ------------------------------------------------------------ actions -- */

  async function saveMonitoring(patch: Partial<MonitoringSettings>) {
    const current = normalizeMonitoringSettings(await monitoringItem.getValue());
    await monitoringItem.setValue({ ...current, ...patch });
  }

  async function toggleGuide(kind: "focus" | "path") {
    dispatch({ type: "NOTICE", message: null });
    try {
      const tab = await getActiveTab();
      await ensureInjected(tab.id);
      if (kind === "focus") {
        const next = !state.guides.focusHelper;
        const response = await send(tab.id, {
          type: "TOGGLE_FOCUS_HELPER",
          payload: { enabled: next },
        });
        if (!alive.current) return;
        if (response?.type === "FOCUS_HELPER_STATE") {
          dispatch({
            type: "GUIDES_APPLIED",
            focusHelper: response.payload.enabled,
            tabPath: state.guides.tabPath,
            summary: state.guides.summary,
          });
          await saveMonitoring({ focusHelperEnabled: response.payload.enabled });
        }
        return;
      }
      const next = !state.guides.tabPath;
      const response = await send(tab.id, {
        type: "TOGGLE_TAB_PATH",
        payload: { enabled: next, options: { maxItems: state.guides.maxItems } },
      });
      if (!alive.current) return;
      if (response?.type === "TAB_PATH_RESULT") {
        dispatch({
          type: "GUIDES_APPLIED",
          focusHelper: state.guides.focusHelper,
          tabPath: response.payload.enabled,
          summary: response.payload.summary,
        });
        await saveMonitoring({ tabPathEnabled: response.payload.enabled });
      }
    } catch (e) {
      if (alive.current) dispatch({ type: "GUIDES_FAILED", message: humanizeError(e) });
    }
  }

  /**
   * Change the keyboard-path marker limit. The choice is always remembered (it
   * is reused by automatic checking); the path is redrawn immediately only when
   * it is already on screen.
   */
  async function changeMaxItems(next: TabPathMaxItems) {
    dispatch({ type: "MAX_ITEMS_CHANGED", maxItems: next });
    try {
      await saveMonitoring({ tabPathMaxItems: next });
    } catch (e) {
      if (alive.current) dispatch({ type: "GUIDES_FAILED", message: humanizeError(e) });
      return;
    }
    if (!state.guides.tabPath) return;
    try {
      const tab = await getActiveTab();
      await ensureInjected(tab.id);
      const response = await send(tab.id, {
        type: "TOGGLE_TAB_PATH",
        payload: { enabled: true, options: { maxItems: next } },
      });
      if (!alive.current) return;
      if (response?.type === "TAB_PATH_RESULT") {
        dispatch({
          type: "GUIDES_APPLIED",
          focusHelper: state.guides.focusHelper,
          tabPath: response.payload.enabled,
          summary: response.payload.summary,
        });
      }
    } catch (e) {
      if (alive.current) dispatch({ type: "GUIDES_FAILED", message: humanizeError(e) });
    }
  }

  async function locate(selector: string) {
    dispatch({ type: "NOTICE", message: "Looking for that item on the page…" });
    try {
      const tab = await getActiveTab();
      await ensureInjected(tab.id);
      const response = await send(tab.id, { type: "LOCATE_ISSUE", payload: { selector } });
      if (!alive.current) return;
      dispatch({
        type: "NOTICE",
        message:
          response?.type === "LOCATE_RESULT" && response.payload.found
            ? "Highlighted that item on the page."
            : "That item is no longer on the page. Check the page again.",
      });
    } catch (e) {
      if (alive.current) dispatch({ type: "NOTICE", message: humanizeError(e) });
    }
  }

  async function startAuto() {
    setBusy(true);
    let effectiveScope = state.auto.scope;
    let message: string | null = null;
    try {
      // The permission request must be the first await after the click so it
      // still counts as a user gesture.
      if (scopeNeedsPermission(effectiveScope)) {
        const origins = hostPermissionsForScope(effectiveScope, state.page.url);
        const granted = await requestOrigins(origins);
        if (!granted) {
          effectiveScope = "current-tab";
          message = PERMISSION_DENIED_MSG;
        }
      }

      // Preserve the remembered guide preferences so Stop -> Start keeps them.
      await saveMonitoring({ enabled: true, scope: effectiveScope });
      const settings = normalizeMonitoringSettings(await monitoringItem.getValue());
      if (!alive.current) return;
      dispatch({ type: "AUTO_STARTED", scope: effectiveScope, message });

      await runScan();
      if (!alive.current) return;

      const tab = await getActiveTab();
      const applied = await send(tab.id, {
        type: "APPLY_MONITORING",
        payload: createApplyMonitoringPayload(settings),
      });
      if (!alive.current) return;
      if (applied?.type === "MONITORING_APPLIED") {
        dispatch({
          type: "GUIDES_APPLIED",
          focusHelper: applied.payload.focusHelper,
          tabPath: applied.payload.tabPath,
          summary: applied.payload.tabPathSummary,
        });
      }
    } catch (e) {
      if (alive.current) dispatch({ type: "AUTO_FAILED", message: humanizeError(e) });
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  async function stopAuto() {
    setBusy(true);
    try {
      await saveMonitoring({ enabled: false });
      if (alive.current) dispatch({ type: "AUTO_STOPPED" });
    } catch (e) {
      // Storage failed: automatic checking is genuinely still on, so say so
      // rather than showing a stopped state that is not real.
      if (alive.current) dispatch({ type: "AUTO_FAILED", message: humanizeError(e) });
      if (alive.current) setBusy(false);
      return;
    }
    try {
      const tab = await getActiveTab();
      await send(tab.id, {
        type: "APPLY_MONITORING",
        payload: { focusHelper: false, tabPath: false },
      });
    } catch {
      // The page has no content script (restricted page, or never injected),
      // so there is nothing to clear. Automatic checking is recorded as off.
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  function buildReport(): string {
    return generateMarkdownReport(state.scan.result!, {
      tabPathSummary: state.guides.summary ?? undefined,
    });
  }

  function downloadReport() {
    if (!state.scan.result) return;
    let url: string | null = null;
    let anchor: HTMLAnchorElement | null = null;
    try {
      const blob = new Blob([buildReport()], { type: "text/markdown" });
      url = URL.createObjectURL(blob);
      anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = reportFileName(state.scan.result.url, state.scan.result.scannedAt);
      // Firefox only follows a click on an anchor that is in the document.
      document.body.appendChild(anchor);
      anchor.click();
      dispatch({ type: "NOTICE", message: "Results saved to your downloads." });
    } catch {
      dispatch({ type: "NOTICE", message: "The results could not be saved. Try copying instead." });
    } finally {
      anchor?.remove();
      // Revoking synchronously can cancel the download that was just started.
      const objectUrl = url;
      if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
    }
  }

  async function copyReport() {
    if (!state.scan.result) return;
    try {
      const ok = await copyTextToClipboard(buildReport());
      if (!alive.current) return;
      dispatch({
        type: "NOTICE",
        message: ok
          ? "Results copied to the clipboard."
          : "Copying is blocked here. You can download the results instead.",
      });
    } catch {
      if (alive.current) {
        dispatch({ type: "NOTICE", message: "Copying is blocked here. Try downloading instead." });
      }
    }
  }

  /* -------------------------------------------------------------- render -- */

  const status = statusLine(state);
  const issues = useMemo(() => issuesForDisplay(state.scan.result), [state.scan.result]);
  const findings = resultsTabCount(state);
  const guidesDisabled = state.page.blocked === "restricted";

  const tabs: TabDescriptor[] = [
    { id: "results", label: "Results", count: findings, countLabel: "possible problems" },
    { id: "guides", label: "Guides" },
    { id: "auto", label: "Automatic" },
  ];

  if (state.boot === "booting") {
    return (
      <div className="shell">
        <p className="boot" role="status">
          Starting {PRODUCT_NAME}…
        </p>
      </div>
    );
  }

  return (
    <div className="shell">
      <header className="header">
        <div className="brand">
          <img className="brand__icon" src="/icon-48.png" alt="" width={32} height={32} />
          <div className="brand__text">
            <h1 className="brand__name">{PRODUCT_NAME}</h1>
            <p className="brand__tagline">{TAGLINE}</p>
          </div>
        </div>

        {/*
          One reserved-height strip carries every transient message (status,
          scan errors, locate and report feedback). Because its height is fixed
          nothing below it can be pushed around, and because there is a single
          live region a scan does not fire a burst of announcements.
        */}
        <div
          className={`header__status${
            status.tone === "error"
              ? " header__status--error"
              : status.tone === "busy"
                ? " header__status--busy"
                : ""
          }`}
        >
          <p className="header__status-text" role="status">
            {state.notice ?? status.text}
          </p>
        </div>

        {state.page.url && (
          <p className="header__page" title={state.page.url}>
            {state.scan.result?.title || state.page.url}
          </p>
        )}

        <button
          type="button"
          className="btn btn--primary btn--block"
          onClick={runScan}
          disabled={!canCheck(state)}
        >
          {state.scan.phase === "checking" ? "Checking…" : "Check this page"}
        </button>
      </header>

      <Tabs
        tabs={tabs}
        selected={state.tab}
        onSelect={(tab: PopupTab) => dispatch({ type: "TAB_SELECTED", tab })}
      />

      <div
        className="shell__body"
        role="tabpanel"
        id={tabPanelId(state.tab)}
        aria-labelledby={tabButtonId(state.tab)}
        tabIndex={0}
      >
        {state.tab === "results" && (
          <ResultsPanel
            state={state}
            issues={issues}
            onLocate={locate}
            onShowMore={() => dispatch({ type: "SHOW_MORE_ISSUES" })}
          />
        )}
        {state.tab === "guides" && (
          <GuidesPanel
            state={state}
            disabled={guidesDisabled}
            onToggleFocusHelper={() => void toggleGuide("focus")}
            onToggleTabPath={() => void toggleGuide("path")}
            onChangeMaxItems={(v) => void changeMaxItems(v)}
          />
        )}
        {state.tab === "auto" && (
          <AutoPanel
            state={state}
            busy={busy}
            onScopeChange={(scope: Exclude<MonitoringScope, "off">) =>
              dispatch({ type: "SCOPE_CHANGED", scope })
            }
            onStart={() => void startAuto()}
            onStop={() => void stopAuto()}
          />
        )}
      </div>

      <footer className="footer">
        <div className="footer__actions">
          <button
            type="button"
            className="btn btn--grow"
            onClick={() => void copyReport()}
            disabled={!canReport(state)}
          >
            Copy results
          </button>
          <button
            type="button"
            className="btn btn--grow"
            onClick={downloadReport}
            disabled={!canReport(state)}
          >
            Save results
          </button>
        </div>
        <p className="footer__note">{canReport(state) ? REPORT_PRIVACY_NOTE : DISCLAIMER}</p>
      </footer>
    </div>
  );
}
