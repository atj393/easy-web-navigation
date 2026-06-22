import { useEffect, useState } from "react";
import { browser } from "#imports";
import { generateMarkdownReport } from "@easy-web-navigation/report-generator";
import { copyTextToClipboard } from "../../lib/clipboard";
import { monitoringItem } from "../../lib/settings";
import {
  automaticCheckingStatusLabel,
  createApplyMonitoringPayload,
  hostPermissionsForScope,
  scopeChoiceLabel,
  scopeExplanation,
  scopeNeedsPermission,
} from "../../lib/monitoring";
import {
  PRODUCT_NAME,
  type ExtensionMessage,
  type IssueSeverity,
  type MonitoringScope,
  type MonitoringSettings,
  type ScanResult,
  type TabPathSummary,
} from "@easy-web-navigation/shared-types";

/**
 * Popup UI.
 *
 * Plain-language wording for everyday users (Phase 1A-UX). The underlying
 * behavior is unchanged: a read-only check of the current page, optional
 * visual guides (keyboard focus highlight / keyboard path), automatic checking
 * within a user-chosen scope, and copy/download of results. Internal scope
 * values and persisted keys are unchanged; only the visible text differs.
 */
const TAGLINE = "Check whether a page is easy to use with a keyboard.";

const DISCLAIMER =
  "This tool checks for possible keyboard-access problems. It does not change the website or " +
  "confirm legal compliance.";

const PERMISSION_DENIED_MSG =
  "We couldn’t get permission, so checking will stay on this page only.";

const ENABLED_NOTE =
  "Your keyboard focus and keyboard path choices will be shown again on supported pages where " +
  "permission allows.";

const SEVERITY_LEGEND: { key: IssueSeverity; label: string }[] = [
  { key: "critical", label: "Critical" },
  { key: "serious", label: "Serious" },
  { key: "moderate", label: "Moderate" },
  { key: "minor", label: "Minor" },
];

const SCOPE_VALUES: MonitoringScope[] = ["current-tab", "site", "all-sites"];

type Phase = "idle" | "scanning" | "done" | "error";

interface SummaryCardProps {
  label: string;
  count: number | "–";
}

function SummaryCard({ label, count }: SummaryCardProps) {
  return (
    <div className="card">
      <span className="card__count">{count}</span>
      <span className="card__label">{label}</span>
    </div>
  );
}

const RESTRICTED = /cannot access|host permission|chrome:\/\/|edge:\/\/|about:|extension|no tab/i;

function humanizeError(message: string): string {
  if (RESTRICTED.test(message)) {
    return "Easy Web Navigation can't act on this page. Browser-internal and extension pages are restricted.";
  }
  return message;
}

async function getActiveTab(): Promise<{ id: number; url: string }> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab.");
  return { id: tab.id, url: tab.url ?? "" };
}

async function ensureInjected(tabId: number): Promise<void> {
  // Idempotent: the content script's init guard prevents double-setup.
  await browser.scripting.executeScript({
    target: { tabId },
    files: ["/content-scripts/content.js"],
  });
}

async function send(
  tabId: number,
  message: ExtensionMessage,
): Promise<ExtensionMessage | undefined> {
  return (await browser.tabs.sendMessage(tabId, message)) as ExtensionMessage | undefined;
}

export function App() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focusHelperOn, setFocusHelperOn] = useState(false);
  const [tabPathOn, setTabPathOn] = useState(false);
  const [tabSummary, setTabSummary] = useState<TabPathSummary | null>(null);
  const [locateStatus, setLocateStatus] = useState<string | null>(null);
  const [reportStatus, setReportStatus] = useState<string | null>(null);
  // Monitoring
  const [monitoringEnabled, setMonitoringEnabled] = useState(false);
  const [monitoringScope, setMonitoringScope] = useState<MonitoringScope>("current-tab");
  const [monitoringMsg, setMonitoringMsg] = useState<string | null>(null);
  // Cached active tab so permission requests stay within the click gesture.
  const [activeUrl, setActiveUrl] = useState<string>("");

  useEffect(() => {
    (async () => {
      // Load persisted monitoring settings (and remembered helper prefs).
      let settings: MonitoringSettings | undefined;
      try {
        settings = await monitoringItem.getValue();
        setMonitoringEnabled(settings.enabled);
        setMonitoringScope(settings.scope === "off" ? "current-tab" : settings.scope);
      } catch {
        /* storage unavailable — defaults stand */
      }
      // Cache the active tab URL up front for gesture-safe permission requests.
      try {
        const tab = await getActiveTab();
        setActiveUrl(tab.url);
      } catch {
        /* no active tab yet */
      }

      if (settings?.enabled) {
        // Monitoring is on: opening the popup is a user gesture, so we may inject
        // into the active tab and re-apply the remembered helpers + scan. This is
        // what makes monitoring re-apply on each supported page (also in the
        // current-tab scope, where the background cannot inject on navigation).
        try {
          const tab = await getActiveTab();
          await ensureInjected(tab.id);
          const scan = await send(tab.id, { type: "SCAN_REQUEST", payload: {} });
          if (scan?.type === "SCAN_RESULT") {
            setResult(scan.payload);
            setPhase("done");
          }
          const applied = await send(tab.id, {
            type: "APPLY_MONITORING",
            payload: createApplyMonitoringPayload(settings),
          });
          if (applied?.type === "MONITORING_APPLIED") {
            setFocusHelperOn(applied.payload.focusHelper);
            setTabPathOn(applied.payload.tabPath);
            setTabSummary(applied.payload.tabPathSummary);
          }
        } catch (e) {
          // Restricted/unsupported page — monitoring can't act here.
          setMonitoringMsg(humanizeError(e instanceof Error ? e.message : String(e)));
        }
        return;
      }

      // Monitoring off: best-effort sync of live helper state (does not inject).
      try {
        const tab = await getActiveTab();
        const focus = await send(tab.id, { type: "GET_FOCUS_HELPER_STATE" });
        if (focus?.type === "FOCUS_HELPER_STATE") setFocusHelperOn(focus.payload.enabled);
        const tp = await send(tab.id, { type: "GET_TAB_PATH_STATE" });
        if (tp?.type === "TAB_PATH_RESULT") {
          setTabPathOn(tp.payload.enabled);
          setTabSummary(tp.payload.summary);
        }
      } catch {
        /* content script not injected yet — helpers are off */
      }
    })();
  }, []);

  async function saveMonitoring(patch: Partial<MonitoringSettings>) {
    const current = await monitoringItem.getValue();
    await monitoringItem.setValue({ ...current, ...patch });
  }

  async function runScan() {
    setPhase("scanning");
    setError(null);
    setResult(null);
    setLocateStatus(null);
    setReportStatus(null);
    try {
      const tab = await getActiveTab();
      await ensureInjected(tab.id);
      const response = await send(tab.id, { type: "SCAN_REQUEST", payload: {} });
      if (!response) throw new Error("No response from the page.");
      if (response.type === "SCAN_ERROR") throw new Error(response.payload.message);
      if (response.type !== "SCAN_RESULT") throw new Error("Unexpected response from the page.");
      setResult(response.payload);
      setPhase("done");
    } catch (e) {
      setError(humanizeError(e instanceof Error ? e.message : String(e)));
      setPhase("error");
    }
  }

  async function toggleFocusHelper() {
    setLocateStatus(null);
    try {
      const tab = await getActiveTab();
      await ensureInjected(tab.id);
      const next = !focusHelperOn;
      const response = await send(tab.id, {
        type: "TOGGLE_FOCUS_HELPER",
        payload: { enabled: next },
      });
      if (response?.type === "FOCUS_HELPER_STATE") {
        setFocusHelperOn(response.payload.enabled);
        await saveMonitoring({ focusHelperEnabled: response.payload.enabled });
      }
    } catch (e) {
      setLocateStatus(humanizeError(e instanceof Error ? e.message : String(e)));
    }
  }

  async function toggleTabPath() {
    setLocateStatus(null);
    try {
      const tab = await getActiveTab();
      await ensureInjected(tab.id);
      const next = !tabPathOn;
      const response = await send(tab.id, {
        type: "TOGGLE_TAB_PATH",
        payload: { enabled: next },
      });
      if (response?.type === "TAB_PATH_RESULT") {
        setTabPathOn(response.payload.enabled);
        setTabSummary(response.payload.summary);
        await saveMonitoring({ tabPathEnabled: response.payload.enabled });
      }
    } catch (e) {
      setLocateStatus(humanizeError(e instanceof Error ? e.message : String(e)));
    }
  }

  async function locate(selector: string) {
    setLocateStatus("Locating…");
    try {
      const tab = await getActiveTab();
      await ensureInjected(tab.id);
      const response = await send(tab.id, { type: "LOCATE_ISSUE", payload: { selector } });
      if (response?.type === "LOCATE_RESULT") {
        setLocateStatus(
          response.payload.found
            ? "Highlighted the element on the page."
            : "That element is no longer on the page.",
        );
      } else {
        setLocateStatus("Could not locate the element.");
      }
    } catch (e) {
      setLocateStatus(humanizeError(e instanceof Error ? e.message : String(e)));
    }
  }

  async function startMonitoring() {
    setMonitoringMsg(null);
    let effectiveScope = monitoringScope;
    try {
      // Request optional host permission FIRST (still inside the click gesture)
      // using the cached active URL — no awaits before request() for site/all.
      if (scopeNeedsPermission(monitoringScope)) {
        const origins = hostPermissionsForScope(monitoringScope, activeUrl);
        if (origins.length === 0) {
          effectiveScope = "current-tab";
          setMonitoringMsg(PERMISSION_DENIED_MSG);
        } else {
          const granted = await browser.permissions.request({ origins });
          if (!granted) {
            effectiveScope = "current-tab";
            setMonitoringMsg(PERMISSION_DENIED_MSG);
          }
        }
      }

      // Enable monitoring + set scope, but PRESERVE the remembered helper
      // preferences (focusHelperEnabled / tabPathEnabled) so Stop→Start keeps
      // them. Toggling a helper persists its preference independently.
      await saveMonitoring({ enabled: true, scope: effectiveScope });
      const settings = await monitoringItem.getValue();
      setMonitoringEnabled(true);
      setMonitoringScope(effectiveScope);

      const tab = await getActiveTab();
      await ensureInjected(tab.id);

      // Scan immediately and show the result.
      const scan = await send(tab.id, { type: "SCAN_REQUEST", payload: {} });
      if (scan?.type === "SCAN_RESULT") {
        setResult(scan.payload);
        setPhase("done");
      } else if (scan?.type === "SCAN_ERROR") {
        setError(humanizeError(scan.payload.message));
        setPhase("error");
      }

      // Re-apply the remembered visual helpers (from saved settings, not stale
      // popup state).
      const applied = await send(tab.id, {
        type: "APPLY_MONITORING",
        payload: createApplyMonitoringPayload(settings),
      });
      if (applied?.type === "MONITORING_APPLIED") {
        setFocusHelperOn(applied.payload.focusHelper);
        setTabPathOn(applied.payload.tabPath);
        setTabSummary(applied.payload.tabPathSummary);
      }
    } catch (e) {
      setMonitoringMsg(humanizeError(e instanceof Error ? e.message : String(e)));
    }
  }

  async function stopMonitoring() {
    try {
      await saveMonitoring({ enabled: false });
      setMonitoringEnabled(false);
      setMonitoringMsg(null);
      const tab = await getActiveTab();
      // Clear any active overlays on the current tab.
      const applied = await send(tab.id, {
        type: "APPLY_MONITORING",
        payload: { focusHelper: false, tabPath: false },
      });
      if (applied?.type === "MONITORING_APPLIED") {
        setFocusHelperOn(false);
        setTabPathOn(false);
        setTabSummary(null);
      }
    } catch {
      // Content script may not be present (e.g. restricted page) — monitoring
      // is still recorded as off; overlays will not re-apply.
      setMonitoringEnabled(false);
      setFocusHelperOn(false);
      setTabPathOn(false);
    }
  }

  function buildReport(): string {
    return generateMarkdownReport(result!, { tabPathSummary: tabSummary ?? undefined });
  }

  function downloadReport() {
    if (!result) {
      setReportStatus("Check this page before saving results.");
      return;
    }
    const blob = new Blob([buildReport()], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "easy-web-navigation-report.md";
    anchor.click();
    URL.revokeObjectURL(url);
    setReportStatus("Results downloaded.");
  }

  async function copyReport() {
    if (!result) {
      setReportStatus("Check this page before saving results.");
      return;
    }
    const ok = await copyTextToClipboard(buildReport());
    setReportStatus(ok ? "Results copied." : "Couldn’t copy. You can still download the results.");
  }

  const summary = result?.summary;
  const labelIssues = summary ? summary.byCategory.forms + summary.byCategory.naming : "–";
  const keyboardIssues = summary ? summary.byCategory.keyboard + summary.byCategory.focus : "–";
  const navigationIssues = summary ? summary.byCategory.navigation : "–";

  const statusText =
    phase === "scanning"
      ? "Checking this page…"
      : phase === "done" && result
        ? `${result.summary.total} problem(s) found`
        : "Ready to check this page.";

  return (
    <main className="popup">
      <header className="popup__header">
        <div className="brand">
          <img className="brand__icon" src="/icon-48.png" alt="" width={36} height={36} />
          <div>
            <h1 className="popup__title">{PRODUCT_NAME}</h1>
            <p className="popup__tagline">{TAGLINE}</p>
          </div>
        </div>
        {phase !== "error" && (
          <p className="popup__status" role="status">
            {statusText}
          </p>
        )}
        {result && (
          <p className="popup__page" title={result.url}>
            {result.title || result.url || "(untitled page)"}
          </p>
        )}
      </header>

      <button
        type="button"
        className="btn btn--primary"
        onClick={runScan}
        disabled={phase === "scanning"}
      >
        {phase === "scanning" ? "Checking…" : "Check this page"}
      </button>

      {phase === "error" && (
        <p className="popup__error" role="alert">
          {error ?? "Something went wrong."}
        </p>
      )}

      <section className="block" aria-labelledby="guides-heading">
        <h2 id="guides-heading" className="block__heading">
          Show on this page
        </h2>
        <p className="block__sub">
          Use these guides to see how a keyboard user moves through the page.
        </p>

        <div className="guide">
          <div className="guide__text">
            <p className="guide__title">Keyboard focus highlight</p>
            <p className="guide__desc">
              Shows a clear outline around the item selected with the Tab key.
            </p>
          </div>
          <button
            type="button"
            className={`btn btn--toggle${focusHelperOn ? " btn--on" : ""}`}
            onClick={toggleFocusHelper}
            aria-pressed={focusHelperOn}
          >
            {focusHelperOn ? "Hide keyboard focus" : "Show keyboard focus"}
          </button>
        </div>

        <div className="guide">
          <div className="guide__text">
            <p className="guide__title">Keyboard path</p>
            <p className="guide__desc">
              Shows numbered markers in the order the Tab key moves through the page.
            </p>
          </div>
          <button
            type="button"
            className={`btn btn--toggle${tabPathOn ? " btn--on" : ""}`}
            onClick={toggleTabPath}
            aria-pressed={tabPathOn}
          >
            {tabPathOn ? "Hide keyboard path" : "Show keyboard path"}
          </button>
        </div>

        {tabPathOn && tabSummary && (
          <p className="popup__tabsummary" role="status">
            Keyboard path: showing {tabSummary.shown} of {tabSummary.totalDetected} item(s)
            {tabSummary.capped && (
              <span className="popup__warn"> · showing the first {tabSummary.shown} for speed</span>
            )}
          </p>
        )}
      </section>

      <section className="block" aria-labelledby="auto-heading">
        <h2 id="auto-heading" className="block__heading">
          Keep checking as you browse
        </h2>
        <p className="block__sub">
          Choose where {PRODUCT_NAME} should continue checking while you browse.
        </p>
        <p className="block__status" role="status">
          Automatic checking:{" "}
          <strong>{automaticCheckingStatusLabel(monitoringScope, monitoringEnabled)}</strong>
        </p>

        <label className="field">
          <span className="field__label">Where should I keep checking?</span>
          <select
            className="field__select"
            value={monitoringScope}
            disabled={monitoringEnabled}
            onChange={(e) => setMonitoringScope(e.target.value as MonitoringScope)}
          >
            {SCOPE_VALUES.map((value) => (
              <option key={value} value={value}>
                {scopeChoiceLabel(value)}
              </option>
            ))}
          </select>
        </label>

        <p className="block__hint">{scopeExplanation(monitoringScope)}</p>
        {monitoringScope === "all-sites" && !monitoringEnabled && (
          <p className="block__hint">
            Your browser will ask for permission before checking all websites.
          </p>
        )}

        {monitoringEnabled ? (
          <button type="button" className="btn btn--on btn--toggle" onClick={stopMonitoring}>
            Stop automatic checking
          </button>
        ) : (
          <button type="button" className="btn btn--primary btn--toggle" onClick={startMonitoring}>
            Start automatic checking
          </button>
        )}

        {monitoringEnabled && <p className="block__hint">{ENABLED_NOTE}</p>}
        {monitoringMsg && (
          <p className="block__msg" role="status">
            {monitoringMsg}
          </p>
        )}
      </section>

      <section className="block" aria-labelledby="results-heading">
        <h2 id="results-heading" className="block__heading">
          What we checked
        </h2>

        <div className="cards" aria-label="Summary">
          <SummaryCard label="Keyboard use" count={keyboardIssues} />
          <SummaryCard label="Moving around the page" count={navigationIssues} />
          <SummaryCard label="Names and labels" count={labelIssues} />
        </div>

        <div className="issues__head">
          <h3 className="section__title">Problems found</h3>
          <ul className="legend" aria-label="How serious">
            {SEVERITY_LEGEND.map(({ key, label }) => (
              <li key={key} className="legend__item">
                <span className={`legend__dot legend__dot--${key}`} aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
        </div>

        {locateStatus && (
          <p className="popup__locate" role="status">
            {locateStatus}
          </p>
        )}

        {!result && (
          <p className="issues__empty">
            Nothing checked yet. Select <strong>Check this page</strong> to review keyboard use,
            movement order, and names and labels.
          </p>
        )}
        {result && result.issues.length === 0 && (
          <p className="issues__empty">
            No problems were found by these checks. This does not mean the page is fully accessible.
          </p>
        )}
        {result && result.issues.length > 0 && (
          <ul className="issue-list">
            {result.issues.map((issue) => (
              <li key={issue.id} className="issue">
                <div className="issue__head">
                  <span className={`badge badge--${issue.severity}`}>{issue.severity}</span>
                  <span className="issue__title">{issue.title}</span>
                </div>
                <p className="issue__wcag">
                  WCAG {issue.wcag.map((c) => `${c.id} (${c.level})`).join(", ")}
                </p>
                <code className="issue__selector">{issue.selector}</code>
                <p className="issue__rec">{issue.recommendation}</p>
                <button
                  type="button"
                  className="btn btn--small"
                  onClick={() => locate(issue.selector)}
                >
                  Show this problem
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="popup__actions">
        <button type="button" className="btn" onClick={copyReport} disabled={!result}>
          Copy results
        </button>
        <button type="button" className="btn" onClick={downloadReport} disabled={!result}>
          Download results
        </button>
      </div>

      {reportStatus && (
        <p className="popup__report-status" role="status">
          {reportStatus}
        </p>
      )}

      <footer className="popup__disclaimer">
        <p>{DISCLAIMER}</p>
      </footer>
    </main>
  );
}
