/**
 * Popup state model.
 *
 * Pure and browser-free on purpose: it imports no extension APIs and touches no
 * DOM, so the whole startup/scan/monitoring lifecycle can be unit-tested.
 *
 * WHY A REDUCER (see RB-001 in docs/OVERNIGHT_AUDIT.md)
 * -----------------------------------------------------
 * The popup used to hold a dozen independent `useState` values, each written by
 * its own `await` inside one startup effect. That produced a long tail of
 * intermediate renders whose *structure* differed (a status line appearing, a
 * page title appearing, a whole results block appearing), which is what the
 * browser's popup autosizer sees. A single reducer with an explicit `boot`
 * phase collapses startup into exactly two structural states — `booting` and
 * `ready` — so the popup's structure is settled before anything interactive is
 * rendered.
 */
import {
  DEFAULT_MONITORING,
  DEFAULT_TAB_PATH_MAX_ITEMS,
  SEVERITY_ORDER,
  TAB_PATH_MAX_ITEMS_VALUES,
  type A11yIssue,
  type MonitoringScope,
  type MonitoringSettings,
  type ScanResult,
  type TabPathMaxItems,
  type TabPathSummary,
} from "@easy-web-navigation/shared-types";

/** Which panel the popup body is showing. */
export type PopupTab = "results" | "guides" | "auto";

/** Lifecycle of the page check. */
export type ScanPhase = "idle" | "checking" | "done" | "error";

/**
 * Why the current page will not be checked.
 * `restricted` — the browser does not allow extensions to read this page.
 * `disabled-here` — the user listed this site on the options page.
 * `null` — checking is available.
 */
export type PageBlock = "restricted" | "disabled-here" | null;

export interface PopupState {
  /** Two structural states only: everything async resolves before `ready`. */
  boot: "booting" | "ready";
  tab: PopupTab;
  page: { url: string; blocked: PageBlock };
  scan: {
    phase: ScanPhase;
    result: ScanResult | null;
    /** Already human-readable when set. */
    error: string | null;
  };
  guides: {
    focusHelper: boolean;
    tabPath: boolean;
    maxItems: TabPathMaxItems;
    summary: TabPathSummary | null;
    /** Guide-specific failure message (human-readable). */
    message: string | null;
  };
  auto: {
    enabled: boolean;
    scope: Exclude<MonitoringScope, "off">;
    /** Automatic-checking message (human-readable). */
    message: string | null;
  };
  /** Transient feedback for locate / copy / download. */
  notice: string | null;
  /** How many findings are rendered before "show the rest". */
  visibleIssues: number;
  /** Options-page preference, resolved during boot. */
  showWcagReferences: boolean;
}

/** Findings rendered before the user asks for the rest (large-result guard). */
export const ISSUE_PAGE_SIZE = 25;

export const INITIAL_STATE: PopupState = {
  boot: "booting",
  tab: "results",
  page: { url: "", blocked: null },
  scan: { phase: "idle", result: null, error: null },
  guides: {
    focusHelper: false,
    tabPath: false,
    maxItems: DEFAULT_TAB_PATH_MAX_ITEMS,
    summary: null,
    message: null,
  },
  auto: { enabled: false, scope: "current-tab", message: null },
  notice: null,
  visibleIssues: ISSUE_PAGE_SIZE,
  showWcagReferences: true,
};

/** Everything resolved during boot, applied to the tree in one commit. */
export interface BootPayload {
  url: string;
  blocked: PageBlock;
  settings: MonitoringSettings;
  /** Present when monitoring already ran a check during boot. */
  result?: ScanResult | null;
  /** Present when live guide state could be read from the page. */
  guides?: { focusHelper: boolean; tabPath: boolean; summary: TabPathSummary | null };
  /** Human-readable problem encountered while booting (never a raw exception). */
  message?: string | null;
  /** Options-page preference: show WCAG criteria beside findings. */
  showWcagReferences?: boolean;
}

export type PopupAction =
  | { type: "BOOTED"; payload: BootPayload }
  | { type: "TAB_SELECTED"; tab: PopupTab }
  | { type: "SCAN_STARTED" }
  | { type: "SCAN_SUCCEEDED"; result: ScanResult }
  | { type: "SCAN_FAILED"; message: string }
  /**
   * Report whichever guide state the page actually told us about. Every field
   * is optional on purpose: a caller that toggled only the focus helper must
   * not also write back the keyboard-path state it read at render time, or two
   * quick toggles let the second response revert the first.
   */
  | {
      type: "GUIDES_APPLIED";
      focusHelper?: boolean;
      tabPath?: boolean;
      summary?: TabPathSummary | null;
    }
  | { type: "GUIDES_FAILED"; message: string }
  | { type: "MAX_ITEMS_CHANGED"; maxItems: TabPathMaxItems }
  | { type: "SCOPE_CHANGED"; scope: Exclude<MonitoringScope, "off"> }
  | { type: "AUTO_STARTED"; scope: Exclude<MonitoringScope, "off">; message: string | null }
  | { type: "AUTO_STOPPED" }
  | { type: "AUTO_FAILED"; message: string }
  | { type: "NOTICE"; message: string | null }
  | { type: "SHOW_MORE_ISSUES" };

export function popupReducer(state: PopupState, action: PopupAction): PopupState {
  switch (action.type) {
    case "BOOTED": {
      const { url, blocked, settings, result, guides, message, showWcagReferences } =
        action.payload;
      const safe = normalizeMonitoringSettings(settings);
      return {
        ...state,
        boot: "ready",
        page: { url, blocked },
        scan: result
          ? { phase: "done", result, error: null }
          : { phase: "idle", result: null, error: null },
        guides: {
          focusHelper: guides?.focusHelper ?? safe.focusHelperEnabled,
          tabPath: guides?.tabPath ?? safe.tabPathEnabled,
          maxItems: safe.tabPathMaxItems,
          summary: guides?.summary ?? null,
          message: null,
        },
        auto: {
          enabled: safe.enabled,
          scope: safe.scope === "off" ? "current-tab" : safe.scope,
          message: message ?? null,
        },
        visibleIssues: ISSUE_PAGE_SIZE,
        showWcagReferences: showWcagReferences ?? state.showWcagReferences,
      };
    }

    case "TAB_SELECTED":
      return state.tab === action.tab ? state : { ...state, tab: action.tab };

    case "SCAN_STARTED":
      return {
        ...state,
        scan: { phase: "checking", result: null, error: null },
        notice: null,
        visibleIssues: ISSUE_PAGE_SIZE,
      };

    case "SCAN_SUCCEEDED":
      return {
        ...state,
        tab: "results",
        scan: { phase: "done", result: action.result, error: null },
        visibleIssues: ISSUE_PAGE_SIZE,
      };

    case "SCAN_FAILED":
      return {
        ...state,
        scan: { phase: "error", result: null, error: action.message },
      };

    case "GUIDES_APPLIED":
      return {
        ...state,
        guides: {
          ...state.guides,
          ...(action.focusHelper !== undefined && { focusHelper: action.focusHelper }),
          ...(action.tabPath !== undefined && { tabPath: action.tabPath }),
          ...(action.summary !== undefined && { summary: action.summary }),
          message: null,
        },
      };

    case "GUIDES_FAILED":
      return { ...state, guides: { ...state.guides, message: action.message } };

    case "MAX_ITEMS_CHANGED":
      return { ...state, guides: { ...state.guides, maxItems: action.maxItems } };

    case "SCOPE_CHANGED":
      // Changing the scope invalidates any message about the previous scope.
      return { ...state, auto: { ...state.auto, scope: action.scope, message: null } };

    case "AUTO_STARTED":
      return {
        ...state,
        auto: { enabled: true, scope: action.scope, message: action.message },
      };

    case "AUTO_STOPPED":
      return {
        ...state,
        auto: { ...state.auto, enabled: false, message: null },
        guides: { ...state.guides, focusHelper: false, tabPath: false, summary: null },
      };

    case "AUTO_FAILED":
      return { ...state, auto: { ...state.auto, message: action.message } };

    case "NOTICE":
      return state.notice === action.message ? state : { ...state, notice: action.message };

    case "SHOW_MORE_ISSUES":
      return { ...state, visibleIssues: state.visibleIssues + ISSUE_PAGE_SIZE };

    default:
      return state;
  }
}

/* ------------------------------------------------------------------------ *
 * Persisted-value validation
 * ------------------------------------------------------------------------ */

const VALID_SCOPES: MonitoringScope[] = ["off", "current-tab", "site", "all-sites"];

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/**
 * Coerce anything that came out of extension storage into valid monitoring
 * settings. Storage is shared with older builds of the extension and can be
 * edited by hand, so no field is trusted: an unknown scope, a non-boolean flag
 * or an out-of-range marker limit all fall back to the default rather than
 * reaching the UI (where, for instance, an unknown scope would leave the
 * <select> showing one value while state held another).
 */
export function normalizeMonitoringSettings(value: unknown): MonitoringSettings {
  const raw = (value ?? {}) as Partial<Record<keyof MonitoringSettings, unknown>>;
  const scope = VALID_SCOPES.includes(raw.scope as MonitoringScope)
    ? (raw.scope as MonitoringScope)
    : DEFAULT_MONITORING.scope;
  return {
    enabled: bool(raw.enabled, DEFAULT_MONITORING.enabled),
    scope,
    focusHelperEnabled: bool(raw.focusHelperEnabled, DEFAULT_MONITORING.focusHelperEnabled),
    tabPathEnabled: bool(raw.tabPathEnabled, DEFAULT_MONITORING.tabPathEnabled),
    tabPathMaxItems: TAB_PATH_MAX_ITEMS_VALUES.includes(raw.tabPathMaxItems as TabPathMaxItems)
      ? (raw.tabPathMaxItems as TabPathMaxItems)
      : DEFAULT_TAB_PATH_MAX_ITEMS,
  };
}

/* ------------------------------------------------------------------------ *
 * Derived view data (pure selectors)
 * ------------------------------------------------------------------------ */

/** A summary card value: a count, or the "nothing checked yet" placeholder. */
export type CardValue = { kind: "count"; value: number } | { kind: "unchecked" };

export interface SummaryCards {
  keyboard: CardValue;
  navigation: CardValue;
  naming: CardValue;
}

const UNCHECKED: CardValue = { kind: "unchecked" };

/**
 * The three plain-language summary cards. Before a check they read "Not checked
 * yet" rather than a placeholder dash, which users read as a real measurement.
 */
export function summaryCards(result: ScanResult | null): SummaryCards {
  if (!result) return { keyboard: UNCHECKED, navigation: UNCHECKED, naming: UNCHECKED };
  const c = result.summary.byCategory;
  return {
    keyboard: { kind: "count", value: c.keyboard + c.focus },
    navigation: { kind: "count", value: c.navigation },
    naming: { kind: "count", value: c.forms + c.naming },
  };
}

const SEVERITY_RANK = new Map(SEVERITY_ORDER.map((s, i) => [s, i]));

/**
 * Findings ordered most urgent first for DISPLAY. The stored ScanResult is
 * never reordered — reports keep the scanner's deterministic rule order.
 */
export function issuesForDisplay(result: ScanResult | null): A11yIssue[] {
  if (!result) return [];
  return [...result.issues].sort(
    (a, b) => (SEVERITY_RANK.get(a.severity) ?? 99) - (SEVERITY_RANK.get(b.severity) ?? 99),
  );
}

/** Status strip contents. `tone` drives styling; the text always stands alone. */
export interface StatusLine {
  text: string;
  tone: "neutral" | "busy" | "error";
}

/**
 * One status sentence for the header strip. Deliberately never claims a page is
 * accessible — only what these checks did or did not find.
 */
export function statusLine(state: PopupState): StatusLine {
  if (state.boot === "booting") return { text: "Starting…", tone: "busy" };
  if (state.scan.phase === "checking") return { text: "Checking this page…", tone: "busy" };
  if (state.scan.phase === "error") {
    return { text: state.scan.error ?? "This page could not be checked.", tone: "error" };
  }
  if (state.page.blocked === "restricted") {
    return { text: "This browser page cannot be checked.", tone: "error" };
  }
  if (state.page.blocked === "disabled-here") {
    return { text: "You turned this site off in settings.", tone: "neutral" };
  }
  const result = state.scan.result;
  if (state.scan.phase === "done" && result) {
    const n = result.summary.total;
    if (n === 0) return { text: "No problems were found by these checks.", tone: "neutral" };
    return {
      text: n === 1 ? "1 possible problem found." : `${n} possible problems found.`,
      tone: "neutral",
    };
  }
  return { text: "Ready to check this page.", tone: "neutral" };
}

/** Whether "Check this page" can run right now. */
export function canCheck(state: PopupState): boolean {
  return state.boot === "ready" && state.scan.phase !== "checking" && state.page.blocked === null;
}

/** Whether a report can be produced right now. */
export function canReport(state: PopupState): boolean {
  return state.scan.result !== null;
}

/** Count badge shown on the Results tab, or null when nothing was checked. */
export function resultsTabCount(state: PopupState): number | null {
  return state.scan.result ? state.scan.result.summary.total : null;
}
