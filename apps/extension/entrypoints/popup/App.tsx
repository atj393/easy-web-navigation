import { useEffect, useState } from "react";
import { browser } from "#imports";
import { generateMarkdownReport } from "@keywise/report-generator";
import type { ExtensionMessage, ScanResult } from "@keywise/shared-types";

/**
 * Popup UI (Phase 0C).
 *
 * "Scan current page" runs a read-only scan of the active tab. "Show focus
 * helper" toggles a read-only visual overlay that rectangles the focused
 * element. Each issue has a "Locate" action that temporarily highlights its
 * element on the page. Nothing here modifies the inspected page.
 */
const DISCLAIMER =
  "KeyWise Web helps inspect keyboard accessibility at runtime. It does not certify legal " +
  "compliance with WCAG, BITV, EN 301 549, EAA, ADA, or Section 508.";

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
    return "KeyWise Web can't act on this page. Browser-internal and extension pages are restricted.";
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
  const [locateStatus, setLocateStatus] = useState<string | null>(null);

  // Best-effort sync of the helper state when the popup opens. Does not inject:
  // if the content script isn't present yet, the message rejects and we stay off.
  useEffect(() => {
    (async () => {
      try {
        const tabId = await getActiveTabId();
        const response = await send(tabId, { type: "GET_FOCUS_HELPER_STATE" });
        if (response?.type === "FOCUS_HELPER_STATE") setFocusHelperOn(response.payload.enabled);
      } catch {
        /* content script not injected yet — helper is off */
      }
    })();
  }, []);

  async function runScan() {
    setPhase("scanning");
    setError(null);
    setResult(null);
    setLocateStatus(null);
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

  function exportReport() {
    if (!result) return;
    const markdown = generateMarkdownReport(result);
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "keywise-report.md";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const summary = result?.summary;
  const labelIssues = summary ? summary.byCategory.forms + summary.byCategory.naming : "–";
  const keyboardIssues = summary ? summary.byCategory.keyboard + summary.byCategory.focus : "–";
  const navigationIssues = summary ? summary.byCategory.navigation : "–";

  const statusText =
    phase === "scanning"
      ? "Scanning the active page…"
      : phase === "error"
        ? (error ?? "Something went wrong.")
        : phase === "done" && result
          ? `${result.summary.total} issue(s) · ${result.focusableCount} focusable element(s)`
          : "Ready. Click “Scan current page”.";

  return (
    <main className="popup">
      <header className="popup__header">
        <h1 className="popup__title">KeyWise Web</h1>
        <p className="popup__status" role="status">
          {statusText}
        </p>
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

      <button
        type="button"
        className={`btn btn--toggle${focusHelperOn ? " btn--on" : ""}`}
        onClick={toggleFocusHelper}
        aria-pressed={focusHelperOn}
      >
        {focusHelperOn ? "Hide focus helper" : "Show focus helper"}
      </button>

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
        <h2 className="section__title">Issues</h2>
        {!result && <p className="issues__empty">No scan run yet.</p>}
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
        <button type="button" className="btn" onClick={exportReport} disabled={!result}>
          Export report
        </button>
      </div>

      <footer className="popup__disclaimer">
        <p>{DISCLAIMER}</p>
      </footer>
    </main>
  );
}
