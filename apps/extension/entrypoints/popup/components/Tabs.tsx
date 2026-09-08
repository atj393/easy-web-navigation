/**
 * Accessible tab strip for the popup body.
 *
 * Implements the WAI-ARIA tabs pattern with manual activation:
 * Left/Right (and Home/End) move focus between tabs; Enter/Space selects. The
 * strip itself is a fixed-height part of the popup shell, so switching panels
 * cannot resize the popup.
 */
import type { PopupTab } from "../state";

export interface TabDescriptor {
  id: PopupTab;
  label: string;
  /** Optional count rendered after the label (e.g. number of findings). */
  count?: number | null;
  /** Spoken suffix so the count is not announced as a bare number. */
  countLabel?: string;
}

export interface TabsProps {
  tabs: TabDescriptor[];
  selected: PopupTab;
  onSelect: (tab: PopupTab) => void;
}

export function tabPanelId(tab: PopupTab): string {
  return `panel-${tab}`;
}

export function tabButtonId(tab: PopupTab): string {
  return `tab-${tab}`;
}

export function Tabs({ tabs, selected, onSelect }: TabsProps) {
  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const index = tabs.findIndex((t) => t.id === selected);
    if (index < 0) return;
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    onSelect(tabs[next].id);
    // Keep focus with the selection so keyboard users stay oriented.
    const el = event.currentTarget.querySelector<HTMLButtonElement>(
      `#${tabButtonId(tabs[next].id)}`,
    );
    el?.focus();
  }

  return (
    <div className="tabs" role="tablist" aria-label="Sections" onKeyDown={onKeyDown}>
      {tabs.map((tab) => {
        const isSelected = tab.id === selected;
        return (
          <button
            key={tab.id}
            id={tabButtonId(tab.id)}
            type="button"
            role="tab"
            className="tabs__tab"
            aria-selected={isSelected}
            aria-controls={tabPanelId(tab.id)}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onSelect(tab.id)}
          >
            {tab.label}
            {typeof tab.count === "number" && (
              <>
                <span className="tabs__count" aria-hidden="true">
                  {tab.count}
                </span>
                <span className="visually-hidden">
                  {`, ${tab.count} ${tab.countLabel ?? "items"}`}
                </span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
