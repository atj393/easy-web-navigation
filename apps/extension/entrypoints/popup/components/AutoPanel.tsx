/**
 * Automatic-checking panel: scope choice, permission expectations, start/stop.
 *
 * Presentational only. The scope wording here must match what the extension
 * actually does — see `lib/monitoring.ts` for the single source of that copy.
 */
import type { MonitoringScope } from "@easy-web-navigation/shared-types";
import {
  automaticCheckingStatusLabel,
  CURRENT_TAB_KEEP_CHECKING_HINT,
  scopeChoiceLabel,
  scopeExplanation,
} from "../../../lib/monitoring";
import { AUTO_ENABLED_NOTE } from "../messages";
import type { PopupState } from "../state";

const SCOPE_VALUES: Exclude<MonitoringScope, "off">[] = ["current-tab", "site", "all-sites"];

export interface AutoPanelProps {
  state: PopupState;
  busy: boolean;
  onScopeChange: (scope: Exclude<MonitoringScope, "off">) => void;
  onStart: () => void;
  onStop: () => void;
}

export function AutoPanel({ state, busy, onScopeChange, onStart, onStop }: AutoPanelProps) {
  const { enabled, scope, message } = state.auto;

  return (
    <div className="panel">
      <p className="section__sub">
        Automatic checking keeps looking at pages while you browse, instead of you opening this
        window each time. It is off until you start it.
      </p>

      <section className="section card-box" aria-labelledby="auto-heading">
        <h2 className="section__title" id="auto-heading">
          Automatic checking: {automaticCheckingStatusLabel(scope, enabled)}
        </h2>

        <label className="field">
          <span className="field__label">Where should checking continue?</span>
          <select
            className="field__select"
            value={scope}
            disabled={enabled || busy}
            onChange={(e) => onScopeChange(e.target.value as Exclude<MonitoringScope, "off">)}
            aria-describedby="scope-explanation"
          >
            {SCOPE_VALUES.map((value) => (
              <option key={value} value={value}>
                {scopeChoiceLabel(value)}
              </option>
            ))}
          </select>
        </label>

        <p className="field__hint" id="scope-explanation">
          {scopeExplanation(scope)}
        </p>

        {scope === "current-tab" && !enabled && (
          <p className="field__hint">{CURRENT_TAB_KEEP_CHECKING_HINT}</p>
        )}

        {scope !== "current-tab" && !enabled && (
          <p className="field__hint">
            Your browser will ask for permission first. You can take that permission away again at
            any time in your browser&rsquo;s extension settings.
          </p>
        )}

        {enabled ? (
          <button type="button" className="btn btn--on btn--block" onClick={onStop} disabled={busy}>
            Stop automatic checking
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--primary btn--block"
            onClick={onStart}
            disabled={busy}
          >
            Start automatic checking
          </button>
        )}

        {enabled && <p className="field__hint">{AUTO_ENABLED_NOTE}</p>}
      </section>

      {message && (
        <p className="note note--warning" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
