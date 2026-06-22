/**
 * Pure, browser-API-free helpers for monitoring mode. Kept side-effect-free so
 * they are unit-testable without a real extension environment.
 */
import {
  DEFAULT_TAB_PATH_MAX_ITEMS,
  PRODUCT_NAME,
  TAB_PATH_MAX_ITEMS_VALUES,
  type MonitoringScope,
  type MonitoringSettings,
  type TabPathMaxItems,
  type TabPathSummary,
} from "@easy-web-navigation/shared-types";

/** Broad optional host patterns used by the "all-sites" scope. */
export const ALL_SITES_ORIGINS = ["http://*/*", "https://*/*"];

/** URL schemes Easy Web Navigation cannot (and must not) inspect. */
const UNSUPPORTED_SCHEMES = [
  "chrome:",
  "edge:",
  "about:",
  "moz-extension:",
  "chrome-extension:",
  "extension:",
  "devtools:",
  "view-source:",
  "file:",
  "data:",
  "javascript:",
  "blob:",
];

/**
 * Whether a page URL can be scanned. Only http/https pages are supported;
 * browser-internal and privileged schemes are rejected. Never throws.
 */
export function isSupportedPageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  let scheme: string;
  try {
    scheme = new URL(url).protocol.toLowerCase();
  } catch {
    return false;
  }
  if (scheme !== "http:" && scheme !== "https:") return false;
  return !UNSUPPORTED_SCHEMES.includes(scheme);
}

/**
 * Build a host-permission match pattern for the "site" scope from a URL,
 * e.g. "https://example.com/*". Returns null for unsupported URLs.
 */
export function originPatternFromUrl(url: string | null | undefined): string | null {
  if (!isSupportedPageUrl(url)) return null;
  try {
    const u = new URL(url as string);
    return `${u.protocol}//${u.host}/*`;
  } catch {
    return null;
  }
}

/**
 * The optional host-permission origins a scope needs to be requested/checked.
 * Returns [] for scopes that need no new permission (off / current-tab) or
 * when a site pattern cannot be derived.
 */
export function hostPermissionsForScope(scope: MonitoringScope, url?: string | null): string[] {
  if (scope === "all-sites") return [...ALL_SITES_ORIGINS];
  if (scope === "site") {
    const pattern = originPatternFromUrl(url);
    return pattern ? [pattern] : [];
  }
  return [];
}

/** Whether starting this scope requires requesting an optional host permission. */
export function scopeNeedsPermission(scope: MonitoringScope): boolean {
  return scope === "site" || scope === "all-sites";
}

/** Merge a partial patch onto monitoring settings (pure). */
export function mergeMonitoringSettings(
  current: MonitoringSettings,
  patch: Partial<MonitoringSettings>,
): MonitoringSettings {
  return { ...current, ...patch };
}

/**
 * Update one remembered helper preference without touching the others
 * (or the enabled/scope state). Used when the user toggles a helper.
 */
export function updateMonitoringHelperPreference(
  current: MonitoringSettings,
  helper: "focus" | "tabPath",
  enabled: boolean,
): MonitoringSettings {
  return helper === "focus"
    ? { ...current, focusHelperEnabled: enabled }
    : { ...current, tabPathEnabled: enabled };
}

/**
 * Coerce any stored/incoming value to a valid keyboard-path marker limit.
 * Old stored settings (no `tabPathMaxItems`) and any out-of-range or
 * non-numeric value safely fall back to the default (100). Capped at 500.
 */
export function normalizeTabPathMaxItems(value: unknown): TabPathMaxItems {
  return TAB_PATH_MAX_ITEMS_VALUES.includes(value as TabPathMaxItems)
    ? (value as TabPathMaxItems)
    : DEFAULT_TAB_PATH_MAX_ITEMS;
}

/** The APPLY_MONITORING payload derived from the remembered preferences. */
export function createApplyMonitoringPayload(settings: MonitoringSettings): {
  focusHelper: boolean;
  tabPath: boolean;
  tabPathMaxItems: TabPathMaxItems;
} {
  return {
    focusHelper: settings.focusHelperEnabled,
    tabPath: settings.tabPathEnabled,
    tabPathMaxItems: normalizeTabPathMaxItems(settings.tabPathMaxItems),
  };
}

/** Whether monitoring should auto-apply at least one visual helper. */
export function shouldAutoApplyHelpers(settings: MonitoringSettings): boolean {
  return settings.enabled && (settings.focusHelperEnabled || settings.tabPathEnabled);
}

/** Human-readable monitoring status label (internal/legacy). */
export function scopeLabel(scope: MonitoringScope, enabled: boolean): string {
  if (!enabled || scope === "off") return "Off";
  switch (scope) {
    case "current-tab":
      return "Current tab";
    case "site":
      return "This site";
    case "all-sites":
      return "All supported websites";
    default:
      return "Off";
  }
}

/* ---- Popup-only display labels (plain language for everyday users) ----
 * These map the unchanged internal scope values to friendly wording. They do
 * not affect monitoring behavior, persisted keys, or permissions.            */

/** Friendly label for the automatic-checking scope <select> options. */
export function scopeChoiceLabel(scope: MonitoringScope): string {
  switch (scope) {
    case "site":
      return "This website";
    case "all-sites":
      return "All websites";
    case "current-tab":
    default:
      return "This page only";
  }
}

/** Friendly "Automatic checking: …" status for the popup. */
export function automaticCheckingStatusLabel(scope: MonitoringScope, enabled: boolean): string {
  if (!enabled || scope === "off") return "Off";
  switch (scope) {
    case "site":
      return "On for this website";
    case "all-sites":
      return "On for all websites";
    case "current-tab":
    default:
      return "On for this page";
  }
}

/**
 * One plain-language explanation of the selected automatic-checking scope.
 * Shown directly under the status line, before and after checking starts, so
 * the "This page only" limitation is never hidden. No technical terms.
 */
export function scopeExplanation(scope: MonitoringScope): string {
  switch (scope) {
    case "site":
      return `${PRODUCT_NAME} can check other pages on this website after you allow browser access.`;
    case "all-sites":
      return `${PRODUCT_NAME} can check normal websites as you browse after you allow browser access.`;
    case "current-tab":
    default:
      return `This choice checks the page you started on. When you open another page, you may need to open ${PRODUCT_NAME} again.`;
  }
}

/**
 * Extra guidance shown only for "This page only" (before starting): how to get
 * continuous checking across pages instead.
 */
export const CURRENT_TAB_KEEP_CHECKING_HINT =
  "To keep checking pages as you browse, choose This website or All websites before starting " +
  "automatic checking.";

/**
 * Plain-language keyboard-path summary for the popup. Uses "keyboard items"
 * (never "focusable items") and reports the real detected total. When the list
 * is limited it adds a hint to choose a higher limit.
 */
export function keyboardPathSummaryText(summary: TabPathSummary): { line: string; hint?: string } {
  if (!summary.capped) {
    return { line: `Showing all ${summary.totalDetected} keyboard items.` };
  }
  return {
    line: `Showing the first ${summary.shown} of ${summary.totalDetected} keyboard items.`,
    hint: "Choose a higher limit to show more.",
  };
}
