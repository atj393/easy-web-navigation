/**
 * Guides panel: the two read-only visual helpers drawn on the inspected page
 * (keyboard focus highlight and keyboard path), plus the marker limit.
 *
 * Presentational only.
 */
import {
  TAB_PATH_MAX_ITEMS_VALUES,
  DEFAULT_TAB_PATH_MAX_ITEMS,
  type TabPathMaxItems,
} from "@easy-web-navigation/shared-types";
import { keyboardPathSummaryText } from "../../../lib/monitoring";
import type { PopupState } from "../state";

export interface GuidesPanelProps {
  state: PopupState;
  disabled: boolean;
  onToggleFocusHelper: () => void;
  onToggleTabPath: () => void;
  onChangeMaxItems: (value: TabPathMaxItems) => void;
}

export function GuidesPanel({
  state,
  disabled,
  onToggleFocusHelper,
  onToggleTabPath,
  onChangeMaxItems,
}: GuidesPanelProps) {
  const { focusHelper, tabPath, maxItems, summary, message } = state.guides;
  const pathText = summary ? keyboardPathSummaryText(summary) : null;

  return (
    <div className="panel">
      <p className="section__sub">
        These guides draw on top of the page so you can see how a keyboard moves through it. They
        never change the page itself.
      </p>

      <section className="section card-box" aria-labelledby="focus-guide-heading">
        <h3 className="section__title" id="focus-guide-heading">
          Keyboard focus highlight
        </h3>
        <p className="section__sub">
          Draws a clear outline around whatever the Tab key has selected.
        </p>
        <button
          type="button"
          className={`btn btn--block${focusHelper ? " btn--on" : ""}`}
          onClick={onToggleFocusHelper}
          aria-pressed={focusHelper}
          disabled={disabled}
        >
          {focusHelper ? "Hide keyboard focus" : "Show keyboard focus"}
        </button>
      </section>

      <section className="section card-box" aria-labelledby="path-guide-heading">
        <h3 className="section__title" id="path-guide-heading">
          Keyboard path
        </h3>
        <p className="section__sub">
          Numbers every stop the Tab key makes, in order, so you can see the route through the page.
        </p>
        <button
          type="button"
          className={`btn btn--block${tabPath ? " btn--on" : ""}`}
          onClick={onToggleTabPath}
          aria-pressed={tabPath}
          disabled={disabled}
        >
          {tabPath ? "Hide keyboard path" : "Show keyboard path"}
        </button>

        <label className="field">
          <span className="field__label">Number of markers to draw</span>
          <select
            className="field__select"
            value={maxItems}
            disabled={disabled}
            onChange={(e) => onChangeMaxItems(Number(e.target.value) as TabPathMaxItems)}
            aria-describedby="markers-hint"
          >
            {TAB_PATH_MAX_ITEMS_VALUES.map((value) => (
              <option key={value} value={value}>
                {value === DEFAULT_TAB_PATH_MAX_ITEMS
                  ? `${value} markers (recommended)`
                  : `${value} markers`}
              </option>
            ))}
          </select>
        </label>
        <span id="markers-hint" className="field__hint">
          More markers can make a very large page slower and harder to read.
        </span>

        {tabPath && pathText && (
          <p className="note">
            {pathText.line}
            {pathText.hint ? ` ${pathText.hint}` : ""}
          </p>
        )}
      </section>

      {message && (
        <p className="note note--warning" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
