/**
 * Popup state model tests.
 *
 * The startup group is the RB-001 regression guard at the state level: the
 * popup must go through exactly two structural states (`booting` -> `ready`),
 * with every persisted value applied in the same commit, so hydration cannot
 * reorganise the tree one field at a time.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_MONITORING,
  DEFAULT_TAB_PATH_MAX_ITEMS,
  type A11yIssue,
  type MonitoringSettings,
  type ScanResult,
} from "@easy-web-navigation/shared-types";
import {
  canCheck,
  canReport,
  INITIAL_STATE,
  ISSUE_PAGE_SIZE,
  issuesForDisplay,
  normalizeMonitoringSettings,
  popupReducer,
  resultsTabCount,
  statusLine,
  summaryCards,
  type PopupAction,
  type PopupState,
} from "./state";

function issue(id: string, severity: A11yIssue["severity"]): A11yIssue {
  return {
    id,
    ruleId: "unlabeled-control",
    title: `Issue ${id}`,
    description: "d",
    wcag: [{ id: "4.1.2", name: "Name, Role, Value", level: "A" }],
    level: "A",
    severity,
    selector: `#${id}`,
    elementPreview: "<button></button>",
    recommendation: "r",
    canAutoEnhance: false,
  };
}

function result(issues: A11yIssue[] = [], overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    url: "https://example.com/page",
    title: "Example",
    scannedAt: 1_700_000_000_000,
    profile: "test",
    issues,
    summary: {
      total: issues.length,
      bySeverity: { critical: 0, serious: 0, moderate: 0, minor: 0, info: 0 },
      byCategory: { keyboard: 0, focus: 0, navigation: 0, forms: 0, naming: 0 },
      byRule: {},
    },
    focusableCount: 12,
    ...overrides,
  };
}

function run(actions: PopupAction[], from: PopupState = INITIAL_STATE): PopupState {
  return actions.reduce(popupReducer, from);
}

const settings: MonitoringSettings = { ...DEFAULT_MONITORING };

describe("startup (RB-001)", () => {
  it("starts in exactly one pre-interactive state", () => {
    expect(INITIAL_STATE.boot).toBe("booting");
    expect(statusLine(INITIAL_STATE).tone).toBe("busy");
  });

  it("applies every persisted value in a single commit", () => {
    const stored: MonitoringSettings = {
      enabled: true,
      scope: "all-sites",
      focusHelperEnabled: true,
      tabPathEnabled: true,
      tabPathMaxItems: 250,
    };
    const next = popupReducer(INITIAL_STATE, {
      type: "BOOTED",
      payload: { url: "https://example.com/", blocked: null, settings: stored },
    });

    // One transition carries all of it — no intermediate combination exists in
    // which, say, the scope is hydrated but the enabled flag is not.
    expect(next.boot).toBe("ready");
    expect(next.auto).toEqual({ enabled: true, scope: "all-sites", message: null });
    expect(next.guides.focusHelper).toBe(true);
    expect(next.guides.tabPath).toBe(true);
    expect(next.guides.maxItems).toBe(250);
  });

  it("never leaves booting for any intermediate action", () => {
    const noise: PopupAction[] = [
      { type: "SCAN_STARTED" },
      { type: "NOTICE", message: "hello" },
      { type: "TAB_SELECTED", tab: "guides" },
      { type: "GUIDES_FAILED", message: "nope" },
    ];
    expect(run(noise).boot).toBe("booting");
  });

  it("keeps the primary action inert until boot finishes", () => {
    expect(canCheck(INITIAL_STATE)).toBe(false);
    const ready = popupReducer(INITIAL_STATE, {
      type: "BOOTED",
      payload: { url: "https://example.com/", blocked: null, settings },
    });
    expect(canCheck(ready)).toBe(true);
  });

  it("marks a restricted page at boot instead of waiting for a failed check", () => {
    const next = popupReducer(INITIAL_STATE, {
      type: "BOOTED",
      payload: { url: "chrome://settings", blocked: "restricted", settings },
    });
    expect(next.page.blocked).toBe("restricted");
    expect(canCheck(next)).toBe(false);
    expect(statusLine(next).tone).toBe("error");
  });

  it("marks a site the user switched off, and will not check it", () => {
    const next = popupReducer(INITIAL_STATE, {
      type: "BOOTED",
      payload: { url: "https://example.com/", blocked: "disabled-here", settings },
    });
    expect(next.page.blocked).toBe("disabled-here");
    expect(canCheck(next)).toBe(false);
    // Not an error: the user asked for this, so the tone stays calm.
    expect(statusLine(next)).toEqual({
      text: "You turned this site off in settings.",
      tone: "neutral",
    });
  });

  it("carries the options-page WCAG preference into the ready state", () => {
    const off = popupReducer(INITIAL_STATE, {
      type: "BOOTED",
      payload: {
        url: "https://example.com/",
        blocked: null,
        settings,
        showWcagReferences: false,
      },
    });
    expect(off.showWcagReferences).toBe(false);
    // Absent means "keep the default", not "turn it off".
    const missing = popupReducer(INITIAL_STATE, {
      type: "BOOTED",
      payload: { url: "https://example.com/", blocked: null, settings },
    });
    expect(missing.showWcagReferences).toBe(true);
  });

  it("adopts a scan produced during boot without a second transition", () => {
    const next = popupReducer(INITIAL_STATE, {
      type: "BOOTED",
      payload: {
        url: "https://example.com/",
        blocked: null,
        settings: { ...settings, enabled: true },
        result: result([issue("a", "serious")]),
      },
    });
    expect(next.scan.phase).toBe("done");
    expect(next.scan.result?.issues).toHaveLength(1);
  });
});

describe("scan lifecycle", () => {
  const booted = popupReducer(INITIAL_STATE, {
    type: "BOOTED",
    payload: { url: "https://example.com/", blocked: null, settings },
  });

  it("moves idle -> checking -> done", () => {
    const checking = popupReducer(booted, { type: "SCAN_STARTED" });
    expect(checking.scan.phase).toBe("checking");
    expect(canCheck(checking)).toBe(false);
    expect(statusLine(checking).text).toBe("Checking this page…");

    const done = popupReducer(checking, { type: "SCAN_SUCCEEDED", result: result() });
    expect(done.scan.phase).toBe("done");
    expect(done.scan.error).toBeNull();
    expect(canReport(done)).toBe(true);
  });

  it("moves idle -> checking -> error and keeps a human message", () => {
    const failed = run(
      [{ type: "SCAN_STARTED" }, { type: "SCAN_FAILED", message: "Try again." }],
      booted,
    );
    expect(failed.scan.phase).toBe("error");
    expect(failed.scan.error).toBe("Try again.");
    expect(statusLine(failed)).toEqual({ text: "Try again.", tone: "error" });
    // A failed check must not leave a stale result behind for the report.
    expect(canReport(failed)).toBe(false);
  });

  it("clears a previous result and notice when a new check starts", () => {
    const withResult = run(
      [
        { type: "SCAN_SUCCEEDED", result: result([issue("a", "minor")]) },
        { type: "NOTICE", message: "Results copied." },
      ],
      booted,
    );
    const restarted = popupReducer(withResult, { type: "SCAN_STARTED" });
    expect(restarted.scan.result).toBeNull();
    expect(restarted.notice).toBeNull();
  });

  it("shows the results tab when a check completes", () => {
    const onGuides = popupReducer(booted, { type: "TAB_SELECTED", tab: "guides" });
    const done = popupReducer(onGuides, { type: "SCAN_SUCCEEDED", result: result() });
    expect(done.tab).toBe("results");
  });

  it("resets progressive disclosure between checks", () => {
    const many = Array.from({ length: 60 }, (_, i) => issue(`i${i}`, "minor"));
    const first = run(
      [{ type: "SCAN_SUCCEEDED", result: result(many) }, { type: "SHOW_MORE_ISSUES" }],
      booted,
    );
    expect(first.visibleIssues).toBe(ISSUE_PAGE_SIZE * 2);
    const second = popupReducer(first, { type: "SCAN_SUCCEEDED", result: result(many) });
    expect(second.visibleIssues).toBe(ISSUE_PAGE_SIZE);
  });
});

describe("visual guides", () => {
  const booted = popupReducer(INITIAL_STATE, {
    type: "BOOTED",
    payload: { url: "https://example.com/", blocked: null, settings },
  });

  it("updates only the guide the page reported on", () => {
    // Two quick toggles: the focus-helper response must not carry the
    // keyboard-path state the caller happened to read at render time, or the
    // second response reverts the first.
    const both = run(
      [
        {
          type: "GUIDES_APPLIED",
          tabPath: true,
          summary: { shown: 5, totalDetected: 5, capped: false },
        },
        { type: "GUIDES_APPLIED", focusHelper: true },
      ],
      booted,
    );
    expect(both.guides.focusHelper).toBe(true);
    expect(both.guides.tabPath).toBe(true);
    expect(both.guides.summary).toEqual({ shown: 5, totalDetected: 5, capped: false });
  });

  it("clears the keyboard-path summary when the path is turned off", () => {
    const on = popupReducer(booted, {
      type: "GUIDES_APPLIED",
      tabPath: true,
      summary: { shown: 3, totalDetected: 9, capped: true },
    });
    const off = popupReducer(on, { type: "GUIDES_APPLIED", tabPath: false, summary: null });
    expect(off.guides.tabPath).toBe(false);
    expect(off.guides.summary).toBeNull();
    // Turning the path off says nothing about the focus helper.
    expect(off.guides.focusHelper).toBe(booted.guides.focusHelper);
  });

  it("clears a guide failure message once a guide reports success", () => {
    const failed = popupReducer(booted, { type: "GUIDES_FAILED", message: "Reload the page." });
    expect(failed.guides.message).toBe("Reload the page.");
    expect(
      popupReducer(failed, { type: "GUIDES_APPLIED", focusHelper: true }).guides.message,
    ).toBeNull();
  });

  it("keeps the marker limit independent of whether the path is showing", () => {
    const changed = popupReducer(booted, { type: "MAX_ITEMS_CHANGED", maxItems: 500 });
    expect(changed.guides.maxItems).toBe(500);
    expect(changed.guides.tabPath).toBe(false);
    const drawn = popupReducer(changed, { type: "GUIDES_APPLIED", tabPath: true, summary: null });
    expect(drawn.guides.maxItems).toBe(500);
  });
});

describe("status wording never overclaims", () => {
  const booted = popupReducer(INITIAL_STATE, {
    type: "BOOTED",
    payload: { url: "https://example.com/", blocked: null, settings },
  });

  it("says what the checks found, not that the page is accessible", () => {
    const clean = popupReducer(booted, { type: "SCAN_SUCCEEDED", result: result() });
    const text = statusLine(clean).text;
    expect(text).toBe("No problems were found by these checks.");
    expect(text.toLowerCase()).not.toMatch(/accessible|compliant|passes|wcag compliant/);
  });

  it("uses singular and plural correctly", () => {
    const one = popupReducer(booted, {
      type: "SCAN_SUCCEEDED",
      result: result([issue("a", "minor")]),
    });
    expect(statusLine(one).text).toBe("1 possible problem found.");
    const two = popupReducer(booted, {
      type: "SCAN_SUCCEEDED",
      result: result([issue("a", "minor"), issue("b", "serious")]),
    });
    expect(statusLine(two).text).toBe("2 possible problems found.");
  });
});

describe("automatic checking", () => {
  const booted = popupReducer(INITIAL_STATE, {
    type: "BOOTED",
    payload: { url: "https://example.com/", blocked: null, settings },
  });

  it("records the scope that was actually applied, not the one requested", () => {
    const started = popupReducer(
      popupReducer(booted, { type: "SCOPE_CHANGED", scope: "all-sites" }),
      { type: "AUTO_STARTED", scope: "current-tab", message: "Permission was not granted." },
    );
    expect(started.auto.scope).toBe("current-tab");
    expect(started.auto.message).toBe("Permission was not granted.");
  });

  it("clears the visible guides when checking stops", () => {
    const running = run(
      [
        { type: "AUTO_STARTED", scope: "site", message: null },
        { type: "GUIDES_APPLIED", focusHelper: true, tabPath: true, summary: null },
      ],
      booted,
    );
    const stopped = popupReducer(running, { type: "AUTO_STOPPED" });
    expect(stopped.auto.enabled).toBe(false);
    expect(stopped.guides.focusHelper).toBe(false);
    expect(stopped.guides.tabPath).toBe(false);
  });

  it("drops a stale message when the scope changes", () => {
    const failed = popupReducer(booted, { type: "AUTO_FAILED", message: "Permission denied." });
    expect(popupReducer(failed, { type: "SCOPE_CHANGED", scope: "site" }).auto.message).toBeNull();
  });
});

describe("persisted-value validation", () => {
  it("falls back for missing storage", () => {
    expect(normalizeMonitoringSettings(undefined)).toEqual(DEFAULT_MONITORING);
    expect(normalizeMonitoringSettings(null)).toEqual(DEFAULT_MONITORING);
  });

  it("rejects an unknown scope rather than desyncing the select", () => {
    expect(normalizeMonitoringSettings({ scope: "everywhere" }).scope).toBe(
      DEFAULT_MONITORING.scope,
    );
    expect(normalizeMonitoringSettings({ scope: 7 }).scope).toBe(DEFAULT_MONITORING.scope);
  });

  it("rejects non-boolean flags", () => {
    const safe = normalizeMonitoringSettings({ enabled: "yes", focusHelperEnabled: 1 });
    expect(safe.enabled).toBe(false);
    expect(safe.focusHelperEnabled).toBe(false);
  });

  it("rejects an out-of-range marker limit", () => {
    expect(normalizeMonitoringSettings({ tabPathMaxItems: 10_000 }).tabPathMaxItems).toBe(
      DEFAULT_TAB_PATH_MAX_ITEMS,
    );
    expect(normalizeMonitoringSettings({ tabPathMaxItems: "500" }).tabPathMaxItems).toBe(
      DEFAULT_TAB_PATH_MAX_ITEMS,
    );
  });

  it("accepts an old record that predates the marker limit", () => {
    const old = { enabled: true, scope: "site", focusHelperEnabled: true, tabPathEnabled: false };
    expect(normalizeMonitoringSettings(old)).toEqual({
      enabled: true,
      scope: "site",
      focusHelperEnabled: true,
      tabPathEnabled: false,
      tabPathMaxItems: DEFAULT_TAB_PATH_MAX_ITEMS,
    });
  });

  it("keeps a corrupted record from reaching the UI through BOOTED", () => {
    const next = popupReducer(INITIAL_STATE, {
      type: "BOOTED",
      payload: {
        url: "https://example.com/",
        blocked: null,
        settings: { scope: "nonsense", tabPathMaxItems: 9 } as unknown as MonitoringSettings,
      },
    });
    expect(next.auto.scope).toBe("current-tab");
    expect(next.guides.maxItems).toBe(DEFAULT_TAB_PATH_MAX_ITEMS);
  });
});

describe("derived view data", () => {
  it("reports 'not checked yet' rather than a placeholder number", () => {
    const cards = summaryCards(null);
    expect(cards.keyboard).toEqual({ kind: "unchecked" });
    expect(cards.navigation).toEqual({ kind: "unchecked" });
    expect(cards.naming).toEqual({ kind: "unchecked" });
    expect(resultsTabCount(INITIAL_STATE)).toBeNull();
  });

  it("groups categories into the three plain-language cards", () => {
    const scan = result();
    scan.summary.byCategory = { keyboard: 2, focus: 1, navigation: 3, forms: 4, naming: 5 };
    expect(summaryCards(scan)).toEqual({
      keyboard: { kind: "count", value: 3 },
      navigation: { kind: "count", value: 3 },
      naming: { kind: "count", value: 9 },
    });
  });

  it("orders findings most serious first without touching the stored result", () => {
    const scan = result([
      issue("a", "minor"),
      issue("b", "critical"),
      issue("c", "moderate"),
      issue("d", "serious"),
    ]);
    expect(issuesForDisplay(scan).map((i) => i.severity)).toEqual([
      "critical",
      "serious",
      "moderate",
      "minor",
    ]);
    // The report must keep the scanner's deterministic order.
    expect(scan.issues.map((i) => i.id)).toEqual(["a", "b", "c", "d"]);
  });
});
