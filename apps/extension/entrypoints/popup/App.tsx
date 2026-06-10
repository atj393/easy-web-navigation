import { useState } from "react";
import { browser } from "#imports";
import { generateMarkdownReport } from "@keywise/report-generator";
import type { ExtensionMessage, ScanResult } from "@keywise/shared-types";

/**
 * Popup UI (Phase 0B).
 *
 * The "Scan current page" button injects the read-only content script into the
 * active tab (activeTab + scripting), requests a scan, and renders the result.
 * Nothing here modifies the inspected page.
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

function humanizeError(message: string): string {
  if (/cannot access|host permission|chrome:\/\/|edge:\/\/|about:|extension/i.test(message)) {
    return "KeyWise Web can't scan this page. Browser-internal and extension pages are restricted.";
  }
  return message;
}

export function App() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runScan() {
    setPhase("scanning");
    setError(null);
    setResult(null);
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error("No active tab to scan.");

      // Inject the runtime content script into the active tab (idempotent).
      await browser.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["/content-scripts/content.js"],
      });

      const request: ExtensionMessage = { type: "SCAN_REQUEST", payload: {} };
      const response = (await browser.tabs.sendMessage(tab.id, request)) as
        | ExtensionMessage
        | undefined;

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
