/**
 * @keywise/shared-types
 *
 * Shared, framework-agnostic type definitions used across the KeyWise Web
 * monorepo (extension app + analysis packages).
 *
 * Phase 0A: type contracts only. No runtime logic lives here.
 */

/** WCAG conformance level. KeyWise Web targets A and AA. */
export type WcagLevel = "A" | "AA" | "AAA";

/** Relative severity of a detected accessibility issue. */
export type IssueSeverity = "info" | "minor" | "moderate" | "serious" | "critical";

/** Lifecycle status of a rule implementation. */
export type RuleStatus = "not-implemented" | "experimental" | "stable";

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
 * In Phase 0A these are only ever placeholder values.
 */
export interface A11yIssue {
  id: string;
  /** Identifier of the rule that produced this issue. */
  ruleId: string;
  severity: IssueSeverity;
  message: string;
  /** Best-effort CSS selector for the offending element. */
  selector?: string;
  /** Short human-readable preview of the element (e.g. tag + text). */
  elementPreview?: string;
  /** WCAG criteria this issue relates to. */
  criteria: WcagCriterion[];
}

/**
 * Static metadata describing an analysis rule.
 * Rule logic is intentionally not part of this contract.
 */
export interface A11yRule {
  id: string;
  title: string;
  level: WcagLevel;
  severity: IssueSeverity;
  criteria: WcagCriterion[];
  status: RuleStatus;
  description?: string;
}

/** Options that may modulate how a scan runs (future use). */
export interface ScanOptions {
  includeHidden?: boolean;
  maxElements?: number;
}

/** A request to scan the current document. */
export interface ScanRequest {
  requestId: string;
  url: string;
  options?: ScanOptions;
}

/** Aggregate counts for a completed scan. */
export interface ScanStats {
  focusableElements: number;
  issues: number;
  durationMs: number;
}

/** The result of a (placeholder, in Phase 0A) document scan. */
export interface ScanResult {
  requestId: string;
  url: string;
  /** Epoch milliseconds when the scan completed. */
  timestamp: number;
  issues: A11yIssue[];
  stats: ScanStats;
  /** Always true in Phase 0A — signals no real analysis was performed. */
  placeholder: boolean;
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
  | { type: "SCAN_REQUEST"; payload: ScanRequest }
  | { type: "SCAN_RESULT"; payload: ScanResult }
  | { type: "FOCUS_HELPER_TOGGLE"; payload: { enabled: boolean } }
  | { type: "SETTINGS_UPDATED"; payload: ExtensionSettings };

/** Sensible defaults for first run. */
export const DEFAULT_SETTINGS: ExtensionSettings = {
  enableVisibleFocusHelper: true,
  showTabPath: false,
  showWcagReferences: true,
  enableSafeEnhancementsManually: false,
  disabledDomains: [],
};
