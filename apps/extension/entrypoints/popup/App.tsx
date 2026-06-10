import { useState } from "react";

/**
 * Popup UI — Phase 0A skeleton.
 *
 * No real scanning happens yet. Buttons are present to establish the shape of
 * the experience; they update local placeholder state only.
 */
const DISCLAIMER =
  "KeyWise Web helps inspect keyboard accessibility at runtime. It does not certify legal " +
  "compliance with WCAG, BITV, EN 301 549, EAA, ADA, or Section 508.";

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

export function App() {
  const [status, setStatus] = useState("Idle — no scan run yet (Phase 0A).");

  return (
    <main className="popup">
      <header className="popup__header">
        <h1 className="popup__title">KeyWise Web</h1>
        <p className="popup__status" role="status">
          {status}
        </p>
      </header>

      <button
        type="button"
        className="btn btn--primary"
        onClick={() => setStatus("Scan is not implemented in Phase 0A.")}
      >
        Scan current page
      </button>

      <section aria-label="Issue summary" className="cards">
        <SummaryCard label="Keyboard issues" count="–" />
        <SummaryCard label="Focus issues" count="–" />
        <SummaryCard label="Navigation issues" count="–" />
      </section>

      <section aria-label="Issues" className="issues">
        <h2 className="section__title">Issues</h2>
        <p className="issues__empty">No issues to show yet.</p>
      </section>

      <div className="popup__actions">
        <button
          type="button"
          className="btn"
          onClick={() => setStatus("Focus helper is not implemented in Phase 0A.")}
        >
          Show focus helper
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => setStatus("Report export is not implemented in Phase 0A.")}
        >
          Export report
        </button>
      </div>

      <footer className="popup__disclaimer">
        <p>{DISCLAIMER}</p>
      </footer>
    </main>
  );
}
