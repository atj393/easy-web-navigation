/**
 * Popup component tests.
 *
 * Rendered into a real jsdom document with `react-dom/client` — no extra test
 * library, and no extension APIs, because these components are presentational.
 * The assertions are about behaviour and accessible semantics, never snapshots.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_MONITORING,
  type A11yIssue,
  type ScanResult,
} from "@easy-web-navigation/shared-types";
import { INITIAL_STATE, issuesForDisplay, popupReducer, type PopupState } from "../state";
import { AutoPanel } from "./AutoPanel";
import { GuidesPanel } from "./GuidesPanel";
import { focusableSummary, ResultsPanel } from "./ResultsPanel";
import { Tabs } from "./Tabs";

// React 18's concurrent renderer expects this flag in test environments.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(node: React.ReactNode): void {
  act(() => root.render(node));
}

function click(el: Element | null): void {
  act(() => {
    (el as HTMLElement).click();
  });
}

function issue(id: string, severity: A11yIssue["severity"], title = `Issue ${id}`): A11yIssue {
  return {
    id,
    ruleId: "unlabeled-control",
    title,
    description: "A button has no accessible name.",
    wcag: [{ id: "4.1.2", name: "Name, Role, Value", level: "A" }],
    level: "A",
    severity,
    selector: `#${id}`,
    elementPreview: "<button></button>",
    recommendation: "Give the control visible text or an aria-label.",
    canAutoEnhance: false,
  };
}

function scanResult(issues: A11yIssue[]): ScanResult {
  return {
    url: "https://example.com/",
    title: "Example",
    scannedAt: 1_700_000_000_000,
    profile: "test",
    issues,
    summary: {
      total: issues.length,
      bySeverity: { critical: 0, serious: 0, moderate: 0, minor: 0, info: 0 },
      byCategory: { keyboard: 1, focus: 1, navigation: 2, forms: 3, naming: 4 },
      byRule: {},
    },
    focusableCount: 9,
  };
}

function ready(overrides: Partial<PopupState> = {}): PopupState {
  const base = popupReducer(INITIAL_STATE, {
    type: "BOOTED",
    payload: { url: "https://example.com/", blocked: null, settings: { ...DEFAULT_MONITORING } },
  });
  return { ...base, ...overrides };
}

describe("ResultsPanel", () => {
  it("says nothing has been checked instead of showing placeholder numbers", () => {
    render(<ResultsPanel state={ready()} issues={[]} onLocate={() => {}} onShowMore={() => {}} />);
    expect(container.textContent).toContain("Not checked yet");
    expect(container.textContent).toContain("Nothing has been checked yet");
    expect(container.querySelectorAll(".issue")).toHaveLength(0);
  });

  it("never claims a clean page is accessible", () => {
    const state = ready({ scan: { phase: "done", result: scanResult([]), error: null } });
    render(<ResultsPanel state={state} issues={[]} onLocate={() => {}} onShowMore={() => {}} />);
    const text = container.textContent ?? "";
    expect(text).toContain("No problems were found by these checks.");
    expect(text.toLowerCase()).not.toMatch(/is accessible|fully accessible|compliant|passes wcag/);
  });

  it("renders each finding with severity, location, and what to check", () => {
    const issues = [issue("a", "serious", "Control has no name")];
    const state = ready({ scan: { phase: "done", result: scanResult(issues), error: null } });
    render(
      <ResultsPanel state={state} issues={issues} onLocate={() => {}} onShowMore={() => {}} />,
    );
    const card = container.querySelector(".issue");
    expect(card).not.toBeNull();
    expect(card?.textContent).toContain("serious");
    expect(card?.textContent).toContain("Control has no name");
    expect(card?.querySelector(".issue__where")?.textContent).toBe("#a");
    expect(card?.textContent).toContain("What to check:");
    expect(card?.textContent).toContain("WCAG 4.1.2 (A)");
  });

  it("names the locate button per finding for screen-reader users", () => {
    const issues = [issue("a", "minor", "First"), issue("b", "minor", "Second")];
    const state = ready({ scan: { phase: "done", result: scanResult(issues), error: null } });
    render(
      <ResultsPanel state={state} issues={issues} onLocate={() => {}} onShowMore={() => {}} />,
    );
    const buttons = [...container.querySelectorAll<HTMLButtonElement>(".issue__actions button")];
    expect(buttons).toHaveLength(2);
    // Same visible label, distinct accessible descriptions.
    expect(new Set(buttons.map((b) => b.textContent))).toEqual(new Set(["Show on page"]));
    const described = buttons.map((b) => b.getAttribute("aria-describedby"));
    expect(new Set(described).size).toBe(2);
    for (const id of described) {
      expect(container.querySelector(`#${id}`)?.textContent).toBeTruthy();
    }
  });

  it("passes the finding's selector to the locate callback", () => {
    const onLocate = vi.fn();
    const issues = [issue("target", "minor")];
    const state = ready({ scan: { phase: "done", result: scanResult(issues), error: null } });
    render(
      <ResultsPanel state={state} issues={issues} onLocate={onLocate} onShowMore={() => {}} />,
    );
    click(container.querySelector(".issue__actions button"));
    expect(onLocate).toHaveBeenCalledWith("#target");
  });

  it("holds back a very long finding list behind an explicit control", () => {
    const many = Array.from({ length: 120 }, (_, i) => issue(`i${i}`, "minor"));
    const state = ready({
      scan: { phase: "done", result: scanResult(many), error: null },
      visibleIssues: 25,
    });
    const onShowMore = vi.fn();
    render(
      <ResultsPanel state={state} issues={many} onLocate={() => {}} onShowMore={onShowMore} />,
    );
    expect(container.querySelectorAll(".issue")).toHaveLength(25);
    const more = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Show 95 more"),
    );
    expect(more).toBeTruthy();
    click(more!);
    expect(onShowMore).toHaveBeenCalled();
  });

  it("explains a restricted page calmly instead of showing an empty result", () => {
    const state = ready({ page: { url: "chrome://settings", blocked: "restricted" } });
    render(<ResultsPanel state={state} issues={[]} onLocate={() => {}} onShowMore={() => {}} />);
    expect(container.textContent).toContain("This page cannot be checked");
    expect(container.querySelectorAll(".card")).toHaveLength(0);
  });

  it("says how much of the page was looked at, once there is a result", () => {
    const issues = [issue("a", "minor")];
    const state = ready({ scan: { phase: "done", result: scanResult(issues), error: null } });
    render(
      <ResultsPanel state={state} issues={issues} onLocate={() => {}} onShowMore={() => {}} />,
    );
    expect(container.textContent).toContain("9 items on this page can take keyboard focus.");
  });

  it("says nothing about focusable items before a check", () => {
    render(<ResultsPanel state={ready()} issues={[]} onLocate={() => {}} onShowMore={() => {}} />);
    expect(container.textContent).not.toContain("can take keyboard focus");
    expect(focusableSummary(null)).toBeNull();
  });

  it("explains a site the user switched off, without calling it an error", () => {
    const state = ready({ page: { url: "https://example.com/", blocked: "disabled-here" } });
    render(<ResultsPanel state={state} issues={[]} onLocate={() => {}} onShowMore={() => {}} />);
    expect(container.textContent).toContain("This site is switched off");
    expect(container.textContent).toContain("Sites to stay off");
    expect(container.querySelectorAll(".card")).toHaveLength(0);
  });

  it("drops WCAG references when the options page turned them off", () => {
    const issues = [issue("a", "serious")];
    const withRefs = ready({ scan: { phase: "done", result: scanResult(issues), error: null } });
    render(
      <ResultsPanel state={withRefs} issues={issues} onLocate={() => {}} onShowMore={() => {}} />,
    );
    expect(container.textContent).toContain("WCAG 4.1.2 (A)");

    const without = { ...withRefs, showWcagReferences: false };
    render(
      <ResultsPanel state={without} issues={issues} onLocate={() => {}} onShowMore={() => {}} />,
    );
    expect(container.textContent).not.toContain("WCAG");
    // The finding, and what to do about it, must still be there.
    expect(container.textContent).toContain("What to check:");
    expect(container.querySelector(".issue__where")?.textContent).toBe("#a");
  });

  it("orders the rendered findings most serious first", () => {
    const issues = [issue("a", "minor"), issue("b", "critical"), issue("c", "moderate")];
    const result = scanResult(issues);
    const state = ready({ scan: { phase: "done", result, error: null } });
    render(
      <ResultsPanel
        state={state}
        issues={issuesForDisplay(result)}
        onLocate={() => {}}
        onShowMore={() => {}}
      />,
    );
    const badges = [...container.querySelectorAll(".badge")].map((b) => b.textContent);
    expect(badges).toEqual(["critical", "moderate", "minor"]);
  });
});

describe("GuidesPanel", () => {
  it("communicates toggle state with aria-pressed and with words", () => {
    const state = ready();
    render(
      <GuidesPanel
        state={state}
        disabled={false}
        onToggleFocusHelper={() => {}}
        onToggleTabPath={() => {}}
        onChangeMaxItems={() => {}}
      />,
    );
    const focusBtn = container.querySelector<HTMLButtonElement>("[aria-pressed]");
    expect(focusBtn?.getAttribute("aria-pressed")).toBe("false");
    expect(focusBtn?.textContent).toBe("Show keyboard focus");

    const on = ready({ guides: { ...state.guides, focusHelper: true } });
    render(
      <GuidesPanel
        state={on}
        disabled={false}
        onToggleFocusHelper={() => {}}
        onToggleTabPath={() => {}}
        onChangeMaxItems={() => {}}
      />,
    );
    const pressed = container.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    expect(pressed?.textContent).toBe("Hide keyboard focus");
  });

  it("disables every guide control on a page that cannot be inspected", () => {
    render(
      <GuidesPanel
        state={ready()}
        disabled
        onToggleFocusHelper={() => {}}
        onToggleTabPath={() => {}}
        onChangeMaxItems={() => {}}
      />,
    );
    const controls = [
      ...container.querySelectorAll<HTMLButtonElement | HTMLSelectElement>("button, select"),
    ];
    expect(controls.length).toBeGreaterThan(0);
    expect(controls.every((c) => c.disabled)).toBe(true);
  });

  it("labels the marker limit and describes its cost", () => {
    render(
      <GuidesPanel
        state={ready()}
        disabled={false}
        onToggleFocusHelper={() => {}}
        onToggleTabPath={() => {}}
        onChangeMaxItems={() => {}}
      />,
    );
    const select = container.querySelector<HTMLSelectElement>(".field__select");
    expect(select?.closest("label")?.textContent).toContain("Number of markers to draw");
    const hintId = select?.getAttribute("aria-describedby");
    expect(container.querySelector(`#${hintId}`)?.textContent).toContain("slower");
  });

  it("reports the keyboard path summary once the path is on", () => {
    const base = ready();
    const state = ready({
      guides: {
        ...base.guides,
        tabPath: true,
        summary: { shown: 100, totalDetected: 342, capped: true },
      },
    });
    render(
      <GuidesPanel
        state={state}
        disabled={false}
        onToggleFocusHelper={() => {}}
        onToggleTabPath={() => {}}
        onChangeMaxItems={() => {}}
      />,
    );
    expect(container.textContent).toContain("Showing the first 100 of 342 keyboard items.");
  });
});

describe("AutoPanel", () => {
  it("locks the scope while automatic checking is running", () => {
    const base = ready();
    const state = ready({ auto: { ...base.auto, enabled: true, scope: "site" } });
    render(
      <AutoPanel
        state={state}
        busy={false}
        onScopeChange={() => {}}
        onStart={() => {}}
        onStop={() => {}}
      />,
    );
    expect(container.querySelector<HTMLSelectElement>(".field__select")?.disabled).toBe(true);
    expect(container.textContent).toContain("Stop automatic checking");
    expect(container.textContent).toContain("Automatic checking: On for this website");
  });

  it("explains the selected scope before anything is started", () => {
    render(
      <AutoPanel
        state={ready()}
        busy={false}
        onScopeChange={() => {}}
        onStart={() => {}}
        onStop={() => {}}
      />,
    );
    const select = container.querySelector<HTMLSelectElement>(".field__select");
    const describedBy = select?.getAttribute("aria-describedby");
    expect(container.querySelector(`#${describedBy}`)?.textContent).toContain(
      "checks the page you started on",
    );
    expect(container.textContent).toContain("Start automatic checking");
  });

  it("warns about the permission prompt for a wider scope", () => {
    const base = ready();
    render(
      <AutoPanel
        state={ready({ auto: { ...base.auto, scope: "all-sites" } })}
        busy={false}
        onScopeChange={() => {}}
        onStart={() => {}}
        onStop={() => {}}
      />,
    );
    expect(container.textContent).toContain("Your browser will ask for permission first.");
    expect(container.textContent).toContain("take that permission away again");
  });
});

describe("Tabs", () => {
  const tabs = [
    { id: "results" as const, label: "Results", count: 3, countLabel: "possible problems" },
    { id: "guides" as const, label: "Guides" },
    { id: "auto" as const, label: "Automatic" },
  ];

  it("implements the ARIA tabs pattern", () => {
    render(<Tabs tabs={tabs} selected="results" onSelect={() => {}} />);
    const list = container.querySelector('[role="tablist"]');
    expect(list?.getAttribute("aria-label")).toBe("Sections");
    const buttons = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    expect(buttons).toHaveLength(3);
    expect(buttons[0].getAttribute("aria-selected")).toBe("true");
    expect(buttons[0].tabIndex).toBe(0);
    // Roving tabindex: only the selected tab is in the tab order.
    expect(buttons.slice(1).every((b) => b.tabIndex === -1)).toBe(true);
    expect(buttons[0].getAttribute("aria-controls")).toBe("panel-results");
  });

  it("announces the finding count as words, not a bare number", () => {
    render(<Tabs tabs={tabs} selected="results" onSelect={() => {}} />);
    const first = container.querySelector('[role="tab"]');
    expect(first?.querySelector(".tabs__count")?.getAttribute("aria-hidden")).toBe("true");
    expect(first?.querySelector(".visually-hidden")?.textContent).toBe(", 3 possible problems");
  });

  it("moves between tabs with the arrow keys and wraps around", () => {
    const onSelect = vi.fn();
    render(<Tabs tabs={tabs} selected="results" onSelect={onSelect} />);
    const list = container.querySelector<HTMLDivElement>('[role="tablist"]')!;

    function key(k: string) {
      act(() => {
        list.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
      });
    }

    key("ArrowRight");
    expect(onSelect).toHaveBeenLastCalledWith("guides");
    key("ArrowLeft");
    expect(onSelect).toHaveBeenLastCalledWith("auto"); // wraps backwards
    key("End");
    expect(onSelect).toHaveBeenLastCalledWith("auto");
    key("Home");
    expect(onSelect).toHaveBeenLastCalledWith("results");
  });

  it("ignores keys that are not part of the pattern", () => {
    const onSelect = vi.fn();
    render(<Tabs tabs={tabs} selected="results" onSelect={onSelect} />);
    const list = container.querySelector<HTMLDivElement>('[role="tablist"]')!;
    act(() => {
      list.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
    });
    expect(onSelect).not.toHaveBeenCalled();
  });
});
