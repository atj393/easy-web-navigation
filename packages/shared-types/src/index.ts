/**
 * @easy-web-navigation/shared-types
 *
 * Shared, framework-agnostic type definitions used across the Easy Web Navigation
 * monorepo (extension app + analysis packages).
 */

/** Finalized product display name. */
export const PRODUCT_NAME = "Easy Web Navigation";

/** Product tagline for user-facing surfaces. */
export const PRODUCT_TAGLINE = "A keyboard accessibility companion for the web.";

/** WCAG conformance level. Easy Web Navigation targets A and AA. */
export type WcagLevel = "A" | "AA" | "AAA";

/** Relative severity of a detected accessibility issue. */
export type IssueSeverity = "info" | "minor" | "moderate" | "serious" | "critical";

/** Lifecycle status of a rule implementation. */
export type RuleStatus = "not-implemented" | "experimental" | "stable";

/** Broad grouping used for summaries and the popup cards. */
export type RuleCategory = "keyboard" | "focus" | "navigation" | "forms" | "naming";

/**
 * A reference to a single WCAG 2.2 success criterion.
 * `id` follows the dotted numbering, e.g. "2.4.7".
 */
export interface WcagCriterion {
  id: string;
  name: string;
  level: WcagLevel;
  /** Canonical Understanding/Quickref URL for the criterion. */
  url?: string;
}

/**
 * A single accessibility finding produced by a scan.
 */
export interface A11yIssue {
  /** Stable-ish id for this finding within a scan (e.g. "positive-tabindex-0"). */
  id: string;
  /** Identifier of the rule that produced this issue. */
  ruleId: string;
  /** Short human title (mirrors the rule title). */
  title: string;
  /** What is wrong and why it matters for keyboard users. */
  description: string;
  /** WCAG criteria this issue relates to. */
  wcag: WcagCriterion[];
  /** Highest relevant conformance level for this issue. */
  level: WcagLevel;
  severity: IssueSeverity;
  /** Best-effort, readable CSS selector for the offending element. */
  selector: string;
  /** Short sanitized preview of the element. */
  elementPreview: string;
  /** Actionable, source-level recommendation. */
  recommendation: string;
  /**
   * Whether a future, opt-in "safe enhancement" could assist at runtime.
   * Always false in Phase 0B — Easy Web Navigation does not mutate the page.
   */
  canAutoEnhance: boolean;
}

/**
 * Static metadata describing an analysis rule. Detection logic is injected
 * elsewhere (see `@easy-web-navigation/wcag-rules`); this is the catalog entry.
 */
export interface A11yRule {
  id: string;
  title: string;
  level: WcagLevel;
  severity: IssueSeverity;
  category: RuleCategory;
  criteria: WcagCriterion[];
  status: RuleStatus;
  description: string;
  recommendation: string;
}

/** Options that may modulate how a scan runs. */
export interface ScanOptions {
  /** Include elements that are not visible. Default false. */
  includeHidden?: boolean;
  /** Traverse open shadow roots. Default true. */
  traverseShadow?: boolean;
}

/** A request to scan the current document. */
export interface ScanRequest {
  options?: ScanOptions;
}

/** Counts of issues for a completed scan. */
export interface ScanSummary {
  total: number;
  bySeverity: Record<IssueSeverity, number>;
  byCategory: Record<RuleCategory, number>;
  byRule: Record<string, number>;
}

/** The result of a read-only document scan. */
export interface ScanResult {
  url: string;
  title: string;
  /** Epoch milliseconds when the scan completed. */
  scannedAt: number;
  /** Human-readable description of the rule profile applied. */
  profile: string;
  issues: A11yIssue[];
  summary: ScanSummary;
  /** Number of keyboard-focusable elements found (context, not an issue). */
  focusableCount: number;
}

/** Options controlling tab-path computation. */
export interface TabPathOptions {
  /** Maximum number of items to return/render. Default 100. */
  maxItems?: number;
  /** Include elements that are not visible. Default false. */
  includeHidden?: boolean;
  /** Traverse open shadow roots. Default true. */
  traverseShadow?: boolean;
}

/** A single stop along the computed keyboard tab order. */
export interface TabPathItem {
  /** 1-based position in the computed tab order. */
  index: number;
  selector: string;
  elementPreview: string;
  tagName: string;
  accessibleName?: string;
  /** Resolved tabindex (0 for naturally focusable elements). */
  tabIndex: number;
  /** Snapshot of the element's bounding box at compute time, if available. */
  rect?: { x: number; y: number; width: number; height: number };
}

/** Summary of a tab-path computation. */
export interface TabPathSummary {
  /** Number of items returned/rendered (after any cap). */
  shown: number;
  /** Total focusable items detected before the cap. */
  totalDetected: number;
  /** True when `totalDetected` exceeded the cap and the list was truncated. */
  capped: boolean;
}

/** Serializable result of a tab-path computation. */
export interface TabPathResult {
  items: TabPathItem[];
  summary: TabPathSummary;
}

/** User-configurable extension settings. */
export interface ExtensionSettings {
  enableVisibleFocusHelper: boolean;
  showTabPath: boolean;
  showWcagReferences: boolean;
  enableSafeEnhancementsManually: boolean;
  disabledDomains: string[];
}

/**
 * Typed message envelope passed between extension surfaces
 * (popup <-> background <-> content). Discriminated on `type`.
 */
export type ExtensionMessage =
  | { type: "PING" }
  | { type: "PONG" }
  | { type: "SCAN_REQUEST"; payload?: ScanRequest }
  | { type: "SCAN_RESULT"; payload: ScanResult }
  | { type: "SCAN_ERROR"; payload: { message: string } }
  // Focus helper (read-only visual overlay) controls.
  | { type: "TOGGLE_FOCUS_HELPER"; payload: { enabled: boolean } }
  | { type: "GET_FOCUS_HELPER_STATE" }
  | { type: "FOCUS_HELPER_STATE"; payload: { enabled: boolean } }
  // Temporarily highlight a scanned issue's element by selector.
  | { type: "LOCATE_ISSUE"; payload: { selector: string } }
  | { type: "LOCATE_RESULT"; payload: { found: boolean } }
  // Tab-path visualization (read-only numbered markers).
  | { type: "TOGGLE_TAB_PATH"; payload: { enabled: boolean; options?: TabPathOptions } }
  | { type: "GET_TAB_PATH_STATE" }
  | { type: "TAB_PATH_RESULT"; payload: { enabled: boolean; summary: TabPathSummary | null } }
  | { type: "SETTINGS_UPDATED"; payload: ExtensionSettings };

/** Sensible defaults for first run. */
export const DEFAULT_SETTINGS: ExtensionSettings = {
  enableVisibleFocusHelper: true,
  showTabPath: false,
  showWcagReferences: true,
  enableSafeEnhancementsManually: false,
  disabledDomains: [],
};

/** All severities, ordered most to least urgent. Useful for summaries/UI. */
export const SEVERITY_ORDER: IssueSeverity[] = ["critical", "serious", "moderate", "minor", "info"];

/** All rule categories. */
export const RULE_CATEGORIES: RuleCategory[] = [
  "keyboard",
  "focus",
  "navigation",
  "forms",
  "naming",
];
