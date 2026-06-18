/**
 * Pure, browser-API-free helpers for monitoring mode. Kept side-effect-free so
 * they are unit-testable without a real extension environment.
 */
import type { MonitoringScope } from "@easy-web-navigation/shared-types";

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

/** Human-readable monitoring status label for the popup. */
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
