# Architecture

> Phase 0A documents the intended architecture. Most behavior described here is represented by
> placeholders in the current code.

## Extension architecture

Easy Web Navigation is a Manifest V3 WebExtension built with [WXT](https://wxt.dev) and React. It targets
Chromium (Chrome, Edge) and Firefox from a single codebase. There are four entrypoints:

- **Background service worker** (`entrypoints/background.ts`) — orchestration only. Routes typed
  messages; never touches the DOM and never makes network requests.
- **Content script** (`entrypoints/content.ts`) — read-only page inspection, injected on demand.
- **Popup** (`entrypoints/popup/`) — React UI for running inspections and viewing summaries.
- **Options** (`entrypoints/options/`) — React UI for user settings, persisted via typed storage.

## Popup ⇄ content ⇄ background messaging

All cross-surface communication uses the typed `ExtensionMessage` union from
`@easy-web-navigation/shared-types`, so every message is discriminated on its `type` field.

```
[ Popup ] --SCAN_REQUEST--------> [ Content script ] --SCAN_RESULT/SCAN_ERROR--> [ Popup ]
[ Popup ] --TOGGLE_FOCUS_HELPER-> [ Content script ] --FOCUS_HELPER_STATE------> [ Popup ]
[ Popup ] --LOCATE_ISSUE--------> [ Content script ] --LOCATE_RESULT-----------> [ Popup ]
[ Popup ] --GET_FOCUS_HELPER_STATE-> [ Content script ] --FOCUS_HELPER_STATE---> [ Popup ]
[ Popup ] --TOGGLE_TAB_PATH-----> [ Content script ] --TAB_PATH_RESULT---------> [ Popup ]
[ Popup ] --GET_TAB_PATH_STATE--> [ Content script ] --TAB_PATH_RESULT---------> [ Popup ]
```

- The popup initiates every action (scan, toggle focus helper, locate an issue, export). It ensures
  the content script is injected (`activeTab` + `scripting`) and messages the tab directly.
- The content script performs read-only inspection, replies with a `ScanResult`, and owns the
  visual overlay (focus helper / issue locator).
- The background worker remains a minimal message router for future cross-surface orchestration.

## Overlay architecture (Phase 0C)

The focus helper and issue locator share one `FocusOverlayController` (`@easy-web-navigation/focus-overlay`),
instantiated and owned by the content script:

- It appends **one** extension-owned `<div>` to `document.body` with an **open shadow root** for
  style isolation. The container is `position:fixed`, `pointer-events:none`, max `z-index`, and
  `aria-hidden="true"`, so it cannot steal focus, block input, or be seen by assistive technology.
- Highlights are absolutely/fixed-positioned boxes computed from `getBoundingClientRect()`, keyed by
  id (`focus` for the live focused element, `locate` for a temporary issue highlight).
- Scroll and resize reposition the boxes (rAF-throttled); disconnected elements auto-clear.
- It **never** touches inspected nodes — no attributes, classes, wrapping, moving, or listeners on
  them. `unmount()`/`destroy()` removes the container, all window listeners, and all timers.

## Report export (Phase 0E)

`@easy-web-navigation/report-generator` renders a `ScanResult` (plus an optional `ReportOptions`
with the latest tab-path summary) into Markdown or a stable JSON shape. It is a pure,
DOM-independent function — no page access — so it is trivially testable.

The popup builds the Markdown report on demand and offers two actions, both confined to the
extension popup document:

- **Copy Markdown report** uses `copyTextToClipboard` (`apps/extension/lib/clipboard.ts`), which
  prefers `navigator.clipboard.writeText` and falls back to a temporary, off-screen `<textarea>` +
  `document.execCommand("copy")` created and removed inside the popup. The helper takes injectable
  dependencies so it is unit-testable.
- **Download Markdown report** creates an object URL from a `Blob` and triggers an anchor download.

Every report includes a prominent disclaimer; a clean report is never presented as a compliance
pass.

## Monitoring mode (Phase 0G)

Monitoring is an explicit, user-started mode that re-applies the remembered visual helpers and
auto-scans supported pages within a chosen scope. It is **off by default**.

- **State** lives in typed storage (`local:monitoring`): `{ enabled, scope, focusHelperEnabled,
tabPathEnabled }`. `MonitoringScope` is `off | current-tab | site | all-sites`. The popup is the
  writer; the content script and background read it. No page content is ever stored.
- **Popup** owns the UX: Start/Stop, the scope selector, and the status label. On Start it persists
  the choice, requests an optional host permission when the scope needs one (from the click
  gesture), scans the active tab, and applies the helpers via `APPLY_MONITORING`. On Stop it
  persists `enabled:false` and clears overlays.
- **Permission flow** (no required broad host permissions): `current-tab` uses `activeTab` only;
  `site` requests `https://<host>/*`; `all-sites` requests `http://*/*` + `https://*/*`. These are
  declared as `optional_host_permissions` and requested only on user action. A denial falls back to
  the current-tab session with a friendly message. (Firefox MV2 does not expose optional host
  permissions, so site/all-sites fall back to current-tab there — see [limitations.md](limitations.md).)
- **Background** is event-driven only: a `tabs.onUpdated` listener injects the read-only content
  script into a navigated tab **only** when monitoring is enabled with a `site`/`all-sites` scope
  and the tab's URL is supported and covered by a granted host permission (checked with
  `permissions.contains`). No polling, no `tabs` permission, no inactive-tab scanning.
- **Content script** reads `local:monitoring` on load and, if enabled, re-applies the remembered
  helpers (read-only) and runs one scan. `isSupportedPageUrl` blocks restricted schemes.

### SPA route monitoring (Phase 0H)

While monitoring is active, the content script also watches for single-page-app route changes via
`apps/extension/lib/spa-monitoring.ts`:

- **Signals:** `history.pushState` / `history.replaceState` are wrapped (the original is always
  called through with the correct `this`; the wrapper only schedules a refresh and is marked to
  avoid double-wrapping), plus `popstate` and `hashchange` listeners. There is **no always-on heavy
  MutationObserver** and **no polling**.
- **Throttling:** signals are trailing-debounced (`DEFAULT_SPA_REFRESH_DELAY_MS`, 400ms), so a burst
  of route events produces a single refresh. The refresh only runs if the normalized route snapshot
  actually changed.
- **Refresh:** tears down and re-establishes the extension-owned overlay on the (possibly replaced)
  DOM, re-applies whichever helpers are enabled (the tab path is recomputed), and runs one read-only
  `scanDocument`. It never mutates page nodes.
- **Lifecycle / cleanup:** the monitor starts on load when monitoring is enabled and via a
  `local:monitoring` storage watch; `stop()` cancels the throttle, removes listeners, and restores
  the wrapped History methods (an `active` flag also neutralizes any wrapper that cannot be
  restored). Stopping monitoring stops the monitor and clears overlays.

## Package responsibilities

| Package                                 | Responsibility                                                        |
| --------------------------------------- | --------------------------------------------------------------------- |
| `@easy-web-navigation/shared-types`     | Framework-agnostic type contracts shared everywhere.                  |
| `@easy-web-navigation/wcag-rules`       | WCAG 2.2 criteria + rule metadata catalog (no detection logic yet).   |
| `@easy-web-navigation/dom-scanner`      | Read-only DOM inspection that produces a `ScanResult`.                |
| `@easy-web-navigation/keyboard-engine`  | Read-only tab-order computation (reuses dom-scanner focusable logic). |
| `@easy-web-navigation/focus-overlay`    | Read-only overlay: focus helper, issue locator, tab-path markers.     |
| `@easy-web-navigation/report-generator` | Renders a `ScanResult` to Markdown or JSON.                           |

Packages expose their TypeScript source directly via the `exports` field and are consumed through
the pnpm workspace; the extension bundler (Vite, via WXT) compiles them. There is no separate build
step for packages in Phase 0A.

## Permissions and security approach

- **Phase 0A permissions:** `activeTab`, `scripting`, `storage` only.
- **No broad host permissions.** `<all_urls>` is intentionally not requested. The content script is
  registered at **runtime** rather than declared in the manifest, and is injected into the active
  tab only when the user invokes the extension, using the temporary grant from `activeTab`.
- **Read-only by default.** The content script never mutates page structure, never injects ARIA,
  and never auto-fixes. Any future "safe enhancement" must be explicit, user-initiated, and
  conservative (see [limitations.md](limitations.md)).
- **No network, no AI, no speech.** The extension does not call external services.
- **Future host access** (e.g. `optional_host_permissions`) is documented but not relied upon by v0.
