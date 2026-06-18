import { useEffect, useState } from "react";
import { browser } from "#imports";
import { generateMarkdownReport } from "@easy-web-navigation/report-generator";
import { copyTextToClipboard } from "../../lib/clipboard";
import { monitoringItem } from "../../lib/settings";
import { hostPermissionsForScope, scopeLabel, scopeNeedsPermission } from "../../lib/monitoring";
import {
  PRODUCT_NAME,
  PRODUCT_TAGLINE,
  type ExtensionMessage,
  type IssueSeverity,
  type MonitoringScope,
  type MonitoringSettings,
  type ScanResult,
  type TabPathSummary,
} from "@easy-web-navigation/shared-types";

/**
 * Popup UI (Phase 0G).
 *
 * Manual: "Scan current page", focus-helper / tab-path toggles, per-issue
 * "Locate", and Copy / Download report. Monitoring: an explicit, user-started
 * mode that re-applies the remembered visual helpers and auto-scans supported
 * pages (within the granted permission scope). Nothing modifies the page; no
 * page content is uploaded.
 */
const DISCLAIMER =
  "Easy Web Navigation inspects keyboard accessibility at runtime. It does not certify legal " +
  "compliance, and a clean report is not a compliance pass.";

const PERMISSION_DENIED_MSG =
  "Permission was not granted. Monitoring is limited to the current active tab session.";

const SEVERITY_LEGEND: { key: IssueSeverity; label: string }[] = [
  { key: "critical", label: "Critical" },
  { key: "serious", label: "Serious" },
  { key: "moderate", label: "Moderate" },
  { key: "minor", label: "Minor" },
];

const SCOPE_OPTIONS: { value: MonitoringScope; label: string }[] = [
  { value: "current-tab", label: "Current tab session" },
  { value: "site", label: "This site" },
  { value: "all-sites", label: "All supported websites" },
];

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
      try {
        const m = await monitoringItem.getValue();
        setMonitoringEnabled(m.enabled);
        setMonitoringScope(m.scope === "off" ? "current-tab" : m.scope);
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
      // Best-effort sync of live helper state (does not inject).
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

      await saveMonitoring({
        enabled: true,
        scope: effectiveScope,
        focusHelperEnabled: focusHelperOn,
        tabPathEnabled: tabPathOn,
      });
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

      // Re-apply the remembered visual helpers.
      const applied = await send(tab.id, {
        type: "APPLY_MONITORING",
        payload: { focusHelper: focusHelperOn, tabPath: tabPathOn },
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
      setReportStatus("Run a scan before exporting a report.");
      return;
    }
    const blob = new Blob([buildReport()], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "easy-web-navigation-report.md";
    anchor.click();
    URL.revokeObjectURL(url);
    setReportStatus("Report downloaded.");
  }

  async function copyReport() {
    if (!result) {
      setReportStatus("Run a scan before exporting a report.");
      return;
    }
    const ok = await copyTextToClipboard(buildReport());
    setReportStatus(
      ok ? "Report copied to clipboard." : "Could not copy report. Download is still available.",
    );
  }

  const summary = result?.summary;
  const labelIssues = summary ? summary.byCategory.forms + summary.byCategory.naming : "–";
  const keyboardIssues = summary ? summary.byCategory.keyboard + summary.byCategory.focus : "–";
  const navigationIssues = summary ? summary.byCategory.navigation : "–";

  const statusText =
    phase === "scanning"
      ? "Scanning the active page…"
      : phase === "done" && result
        ? `${result.summary.total} issue(s) · ${result.focusableCount} focusable element(s)`
        : "Ready — scan the current page to begin.";

  return (
    <main className="popup">
      <header className="popup__header">
        <div className="brand">
          <img className="brand__icon" src="/icon-48.png" alt="" width={32} height={32} />
          <div>
            <h1 className="popup__title">{PRODUCT_NAME}</h1>
            <p className="popup__tagline">{PRODUCT_TAGLINE}</p>
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
        {phase === "scanning" ? "Scanning…" : "Scan current page"}
      </button>

      {phase === "error" && (
        <p className="popup__error" role="alert">
          {error ?? "Something went wrong."}
        </p>
      )}

      <section className="monitor" aria-label="Monitoring">
        <p className="monitor__state">
          Monitoring: <strong>{scopeLabel(monitoringScope, monitoringEnabled)}</strong>
        </p>
        {monitoringEnabled && (
          <p className="monitor__spa">Active · SPA route changes refresh automatically.</p>
        )}
        <label className="monitor__scope">
          <span>Scope</span>
          <select
            value={monitoringScope}
            disabled={monitoringEnabled}
            onChange={(e) => setMonitoringScope(e.target.value as MonitoringScope)}
          >
            {SCOPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {monitoringEnabled ? (
          <button type="button" className="btn btn--on btn--toggle" onClick={stopMonitoring}>
            Stop monitoring
          </button>
        ) : (
          <button type="button" className="btn btn--primary btn--toggle" onClick={startMonitoring}>
            Start monitoring
          </button>
        )}
        <p className="monitor__desc">
          When monitoring is on, {PRODUCT_NAME} scans supported pages automatically and re-applies
          the visual helpers you enabled. It does not upload page content or change the website.
          {monitoringScope === "all-sites" && !monitoringEnabled
            ? " “All supported websites” asks for permission to inspect every http/https page."
            : null}
        </p>
        {monitoringMsg && (
          <p className="monitor__msg" role="status">
            {monitoringMsg}
          </p>
        )}
      </section>

      <div className="popup__tools">
        <button
          type="button"
          className={`btn btn--toggle${focusHelperOn ? " btn--on" : ""}`}
          onClick={toggleFocusHelper}
          aria-pressed={focusHelperOn}
        >
          {focusHelperOn ? "Hide focus helper" : "Show focus helper"}
        </button>
        <button
          type="button"
          className={`btn btn--toggle${tabPathOn ? " btn--on" : ""}`}
          onClick={toggleTabPath}
          aria-pressed={tabPathOn}
        >
          {tabPathOn ? "Hide tab path" : "Show tab path"}
        </button>
      </div>

      {tabPathOn && tabSummary && (
        <p className="popup__tabsummary" role="status">
          Tab path: {tabSummary.shown} of {tabSummary.totalDetected} focusable item(s)
          {tabSummary.capped && (
            <span className="popup__warn"> · capped at {tabSummary.shown} for performance</span>
          )}
        </p>
      )}

      {locateStatus && (
        <p className="popup__locate" role="status">
          {locateStatus}
        </p>
      )}

      <section aria-label="Issue summary" className="cards">
        <SummaryCard label="Keyboard" count={keyboardIssues} />
        <SummaryCard label="Navigation" count={navigationIssues} />
        <SummaryCard label="Labels" count={labelIssues} />
      </section>

      <section aria-label="Issues" className="issues">
        <div className="issues__head">
          <h2 className="section__title">Issues</h2>
          <ul className="legend" aria-label="Severity legend">
            {SEVERITY_LEGEND.map(({ key, label }) => (
              <li key={key} className="legend__item">
                <span className={`legend__dot legend__dot--${key}`} aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
        </div>

        {!result && (
          <p className="issues__empty">
            No scan yet. Click <strong>Scan current page</strong> to inspect keyboard accessibility,
            focus, tab order, and accessible names.
          </p>
        )}
        {result && result.issues.length === 0 && (
          <p className="issues__empty">
            No issues found by the implemented rules. This is not a guarantee of accessibility.
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
                  Locate on page
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="popup__actions">
        <button type="button" className="btn" onClick={copyReport} disabled={!result}>
          Copy Markdown report
        </button>
        <button type="button" className="btn" onClick={downloadReport} disabled={!result}>
          Download Markdown report
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
