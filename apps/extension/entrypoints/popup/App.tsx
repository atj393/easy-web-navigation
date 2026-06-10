import { useEffect, useState } from "react";
import { browser } from "#imports";
import { generateMarkdownReport } from "@easy-web-navigation/report-generator";
import { copyTextToClipboard } from "../../lib/clipboard";
import {
  PRODUCT_NAME,
  PRODUCT_TAGLINE,
  type ExtensionMessage,
  type IssueSeverity,
  type ScanResult,
  type TabPathSummary,
} from "@easy-web-navigation/shared-types";

/**
 * Popup UI (Phase 0F).
 *
 * "Scan current page" runs a read-only scan of the active tab. "Show focus
 * helper" and "Show tab path" toggle read-only visual overlays. Each issue has
 * a "Locate" action. The Markdown report can be copied or downloaded. Nothing
 * here modifies the inspected page.
 */
const DISCLAIMER =
  "Easy Web Navigation inspects keyboard accessibility at runtime. It does not certify legal " +
  "compliance, and a clean report is not a compliance pass.";

const SEVERITY_LEGEND: { key: IssueSeverity; label: string }[] = [
  { key: "critical", label: "Critical" },
  { key: "serious", label: "Serious" },
  { key: "moderate", label: "Moderate" },
  { key: "minor", label: "Minor" },
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

async function getActiveTabId(): Promise<number> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab.");
  return tab.id;
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

  // Best-effort sync of helper/tab-path state when the popup opens. Does not
  // inject: if the content script isn't present yet, the message rejects and
  // we stay in the default (off) state.
  useEffect(() => {
    (async () => {
      try {
        const tabId = await getActiveTabId();
        const focus = await send(tabId, { type: "GET_FOCUS_HELPER_STATE" });
        if (focus?.type === "FOCUS_HELPER_STATE") setFocusHelperOn(focus.payload.enabled);
        const tab = await send(tabId, { type: "GET_TAB_PATH_STATE" });
        if (tab?.type === "TAB_PATH_RESULT") {
          setTabPathOn(tab.payload.enabled);
          setTabSummary(tab.payload.summary);
        }
      } catch {
        /* content script not injected yet — everything is off */
      }
    })();
  }, []);

  async function runScan() {
    setPhase("scanning");
    setError(null);
    setResult(null);
    setLocateStatus(null);
    setReportStatus(null);
    try {
      const tabId = await getActiveTabId();
      await ensureInjected(tabId);
      const response = await send(tabId, { type: "SCAN_REQUEST", payload: {} });
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
      const tabId = await getActiveTabId();
      await ensureInjected(tabId);
      const next = !focusHelperOn;
      const response = await send(tabId, {
        type: "TOGGLE_FOCUS_HELPER",
        payload: { enabled: next },
      });
      if (response?.type === "FOCUS_HELPER_STATE") setFocusHelperOn(response.payload.enabled);
    } catch (e) {
      setLocateStatus(humanizeError(e instanceof Error ? e.message : String(e)));
    }
  }

  async function toggleTabPath() {
    setLocateStatus(null);
    try {
      const tabId = await getActiveTabId();
      await ensureInjected(tabId);
      const next = !tabPathOn;
      const response = await send(tabId, {
        type: "TOGGLE_TAB_PATH",
        payload: { enabled: next },
      });
      if (response?.type === "TAB_PATH_RESULT") {
        setTabPathOn(response.payload.enabled);
        setTabSummary(response.payload.summary);
      }
    } catch (e) {
      setLocateStatus(humanizeError(e instanceof Error ? e.message : String(e)));
    }
  }

  async function locate(selector: string) {
    setLocateStatus("Locating…");
    try {
      const tabId = await getActiveTabId();
      await ensureInjected(tabId);
      const response = await send(tabId, { type: "LOCATE_ISSUE", payload: { selector } });
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

  function buildReport(): string {
    // Include the latest tab-path summary when we have one (clearly labeled in
    // the report as a runtime visual aid, not an audit metric).
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
