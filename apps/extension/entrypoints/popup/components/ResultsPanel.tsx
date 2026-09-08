/**
 * Results panel: the three plain-language summary cards plus the findings list.
 *
 * Presentational only — it takes data and callbacks, touches no browser API,
 * and is unit-tested against a real DOM.
 */
import type { A11yIssue, ScanResult } from "@easy-web-navigation/shared-types";
import {
  DISABLED_SITE_BODY,
  DISABLED_SITE_TITLE,
  NOTHING_CHECKED_YET,
  NOT_CHECKED_YET,
  NO_PROBLEMS_FOUND,
  RESTRICTED_PAGE_BODY,
  RESTRICTED_PAGE_TITLE,
} from "../messages";
import { summaryCards, type CardValue, type PopupState } from "../state";

/** Plain-language explanation of what each severity means for a reader. */
const SEVERITY_MEANING: Record<string, string> = {
  critical: "Very likely to block a keyboard user completely.",
  serious: "Likely to stop a keyboard user finishing a task.",
  moderate: "Makes keyboard use confusing or slow.",
  minor: "A small problem worth tidying up.",
  info: "Context only, not a problem on its own.",
};

function SummaryCard({ label, value }: { label: string; value: CardValue }) {
  return (
    <div className="card">
      {value.kind === "count" ? (
        <span className="card__count">{value.value}</span>
      ) : (
        <span className="card__count card__count--empty">{NOT_CHECKED_YET}</span>
      )}
      <span className="card__label">{label}</span>
    </div>
  );
}

function IssueCard({
  issue,
  showWcag,
  onLocate,
}: {
  issue: A11yIssue;
  showWcag: boolean;
  onLocate: (selector: string) => void;
}) {
  const headingId = `issue-${issue.id}`;
  const meaning = SEVERITY_MEANING[issue.severity] ?? "";
  return (
    <li className={`issue issue--${issue.severity}`}>
      <div className="issue__head">
        <span className={`badge badge--${issue.severity}`}>{issue.severity}</span>
        <h4 className="issue__title" id={headingId}>
          {issue.title}
        </h4>
      </div>
      <p className="issue__why">{issue.description}</p>
      <code className="issue__where">{issue.selector || "(no selector)"}</code>
      <p className="issue__fix">
        <strong>What to check: </strong>
        {issue.recommendation}
      </p>
      <p className="issue__meta">
        {meaning}
        {showWcag && issue.wcag.length > 0 && (
          <> Related to WCAG {issue.wcag.map((c) => `${c.id} (${c.level})`).join(", ")}.</>
        )}
      </p>
      <div className="issue__actions">
        <button
          type="button"
          className="btn btn--small"
          onClick={() => onLocate(issue.selector)}
          aria-describedby={headingId}
        >
          Show on page
        </button>
      </div>
    </li>
  );
}

export interface ResultsPanelProps {
  state: PopupState;
  issues: A11yIssue[];
  onLocate: (selector: string) => void;
  onShowMore: () => void;
}

export function ResultsPanel({ state, issues, onLocate, onShowMore }: ResultsPanelProps) {
  const cards = summaryCards(state.scan.result);
  const shown = issues.slice(0, state.visibleIssues);
  const remaining = issues.length - shown.length;

  if (state.page.blocked !== null) {
    const restricted = state.page.blocked === "restricted";
    return (
      <div className="panel">
        <section className="section">
          <h3 className="section__title">
            {restricted ? RESTRICTED_PAGE_TITLE : DISABLED_SITE_TITLE}
          </h3>
          <p className="empty">{restricted ? RESTRICTED_PAGE_BODY : DISABLED_SITE_BODY}</p>
        </section>
      </div>
    );
  }

  return (
    <div className="panel">
      <section className="section" aria-labelledby="summary-heading">
        <h3 className="section__title" id="summary-heading">
          What was checked
        </h3>
        <div className="cards">
          <SummaryCard label="Keyboard use" value={cards.keyboard} />
          <SummaryCard label="Moving around the page" value={cards.navigation} />
          <SummaryCard label="Names and labels" value={cards.naming} />
        </div>
      </section>

      <section className="section" aria-labelledby="findings-heading">
        <h3 className="section__title" id="findings-heading">
          Possible problems
        </h3>

        {!state.scan.result && <p className="empty">{NOTHING_CHECKED_YET}</p>}

        {state.scan.result && issues.length === 0 && <p className="empty">{NO_PROBLEMS_FOUND}</p>}

        {issues.length > 0 && (
          <>
            <ul className="issue-list">
              {shown.map((issue) => (
                <IssueCard
                  key={issue.id}
                  issue={issue}
                  showWcag={state.showWcagReferences}
                  onLocate={onLocate}
                />
              ))}
            </ul>
            {remaining > 0 && (
              <button type="button" className="btn btn--block" onClick={onShowMore}>
                {`Show ${remaining} more`}
              </button>
            )}
            <p className="section__sub">
              Most serious problems are listed first. These checks cannot find every keyboard
              problem, and a clean result is not a guarantee.
            </p>
          </>
        )}
      </section>
    </div>
  );
}

/** Exported for tests and for the scan-details line. */
export function focusableSummary(result: ScanResult | null): string | null {
  if (!result) return null;
  const n = result.focusableCount;
  return n === 1 ? "1 item can take keyboard focus." : `${n} items can take keyboard focus.`;
}
