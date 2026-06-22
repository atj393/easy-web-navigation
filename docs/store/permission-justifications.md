# Permission justifications

Easy Web Navigation requests the minimum permissions needed and no broad required host permissions.

## activeTab (required)

- **Why:** Lets the extension inspect the page in the currently active tab.
- **When used:** Only after an explicit user action (clicking the toolbar button to scan, toggle a
  helper, locate an issue, or start monitoring).
- **User-triggered:** Yes.
- **Does data leave the device:** No. The page DOM is read locally to compute findings.
- **Risk mitigation:** Grants access to the active tab only, transiently, on user gesture. No
  standing access to all sites.

## scripting (required)

- **Why:** Injects the read-only inspection content script into the active tab on demand.
- **When used:** When the user scans/toggles/monitors. The content script is registered at runtime
  (not declared for all URLs in the manifest).
- **User-triggered:** Yes.
- **Does data leave the device:** No.
- **Risk mitigation:** The injected script is packaged in the extension (no remote code). It is
  read-only: it never modifies inspected page nodes; the only DOM it creates is an extension-owned
  overlay container that is removed when unused.

## storage (required)

- **Why:** Persists user preferences locally (focus-helper / tab-path choices, monitoring scope,
  monitoring on/off).
- **When used:** When the user changes a setting or toggles a helper.
- **User-triggered:** Yes.
- **Does data leave the device:** No. Uses local extension storage only.
- **Risk mitigation:** Stores only small preference values — no page content, no history.

## optional*host_permissions: http://*/_, https://_/\_ (optional)

- **Why:** For the "This website" and "All websites" automatic-checking scopes, so the extension can
  re-apply the chosen visual helpers and scan as the user navigates across pages.
- **When used:** Requested **only** at the moment the user starts automatic checking with one of
  those scopes — never at install time, never by default. Manual checking and "This page only"
  automatic checking do not request them.
- **User-triggered:** Yes (explicit Start action + the browser's own permission prompt).
- **Does data leave the device:** No. Even with these granted, all analysis remains local.
- **Risk mitigation:** Optional and revocable in the browser's extension settings at any time. If
  the user denies the prompt, monitoring falls back to the current-tab session.

## Permissions explicitly NOT used

`tabs`, `webRequest`, `cookies`, `history`, `downloads`, `clipboardRead`, `clipboardWrite`,
`unlimitedStorage`, `management`, `nativeMessaging`, `declarativeNetRequest`, `bookmarks`,
`identity`, `notifications`, `geolocation`, and any required broad `host_permissions`.
