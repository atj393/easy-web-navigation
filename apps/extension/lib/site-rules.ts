/**
 * Per-site opt-out rules.
 *
 * The options page has always offered a "Disabled domains" list described as
 * "Easy Web Navigation stays inactive on these". Until now the list was stored
 * and never read, so the promise was not kept. These helpers are the single
 * place that decides whether a page is excluded; the popup, the background
 * worker and the content script all consult them.
 *
 * Pure and browser-API-free so the matching rules are unit-testable.
 */

/**
 * Normalise one user-entered line into a bare host.
 *
 * People type what they see, so entries arrive in every shape:
 * "example.com", "https://example.com/path", "  EXAMPLE.com  ", "*.example.com",
 * "example.com:8443". All of those mean the same site.
 */
export function normalizeDomainEntry(entry: string): string {
  let value = (entry ?? "").trim().toLowerCase();
  if (!value) return "";
  // Drop a leading wildcard label: "*.example.com" -> "example.com".
  value = value.replace(/^\*\./, "");
  // Drop a scheme and anything after the authority.
  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  value = value.split("/")[0];
  value = value.split("?")[0];
  value = value.split("#")[0];
  // Credentials and port are not part of the site identity here.
  value = value.split("@").pop() ?? "";
  value = value.replace(/:\d+$/, "");
  value = value.replace(/\.+$/, "");
  return /^[a-z0-9.-]+$/.test(value) ? value : "";
}

/** Clean a stored list: normalised, de-duplicated, empties removed. */
export function normalizeDisabledDomains(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const host = normalizeDomainEntry(entry);
    if (host) seen.add(host);
  }
  return [...seen];
}

/**
 * The lowercase host of an http(s) URL, or "" for anything else.
 *
 * Restricted to http/https on purpose: the extension only ever inspects those,
 * and other schemes parse in surprising ways ("chrome://settings" yields the
 * hostname "settings", which must not be matchable by a domain entry).
 */
export function hostOf(url: string | null | undefined): string {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return parsed.hostname.toLowerCase().replace(/\.+$/, "");
  } catch {
    return "";
  }
}

/**
 * Whether a URL is excluded by the user's list.
 *
 * An entry covers the host itself and its subdomains — "example.com" disables
 * "www.example.com" and "app.example.com" — because that is what a person
 * writing down a site means. It deliberately does NOT match by substring, so
 * "example.com" leaves "notexample.com" and "example.com.evil.test" alone.
 */
export function isSiteDisabled(url: string | null | undefined, disabled: unknown): boolean {
  const host = hostOf(url);
  if (!host) return false;
  return normalizeDisabledDomains(disabled).some(
    (entry) => host === entry || host.endsWith(`.${entry}`),
  );
}
