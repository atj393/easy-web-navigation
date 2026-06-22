/**
 * Pure, browser-API-free helpers for monitoring mode. Kept side-effect-free so
 * they are unit-testable without a real extension environment.
 */
import type { MonitoringScope, MonitoringSettings } from "@easy-web-navigation/shared-types";

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

/** The APPLY_MONITORING payload derived from the remembered preferences. */
export function createApplyMonitoringPayload(settings: MonitoringSettings): {
  focusHelper: boolean;
  tabPath: boolean;
} {
  return { focusHelper: settings.focusHelperEnabled, tabPath: settings.tabPathEnabled };
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

/** One plain-language explanation of the selected automatic-checking scope. */
export function scopeExplanation(scope: MonitoringScope): string {
  switch (scope) {
    case "site":
      return "Keeps checking pages you open on this website after you allow access.";
    case "all-sites":
      return "Keeps checking normal websites you visit after you allow access.";
    case "current-tab":
    default:
      return "This page only may stop when you move to another website. Choose This website to keep checking pages there.";
  }
}
