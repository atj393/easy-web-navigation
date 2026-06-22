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

## Keyboard-path visibility filter (Phase 1A-UX-Visibility-Fix)

The keyboard path is computed by `@easy-web-navigation/keyboard-engine`'s `computeTabPath`, which
reuses the scanner's focusable detection and browser-like tab ordering. A control can be in the
sequential tab order yet be invisible to a sighted user — e.g. a collapsed sidebar/drawer that stays
in the DOM. To avoid drawing markers for such controls, `computeTabPath` applies a dedicated,
site-independent visual-availability filter **after** sorting and **before** the marker limit:

```
collectFocusableElements → sortFocusableElementsForTabOrder
  → filter(isVisuallyAvailableForKeyboardPath) → slice(maxItems) → render markers
```

`isVisuallyAvailableForKeyboardPath` (in `@easy-web-navigation/dom-scanner`) excludes a control when
it (or an ancestor) is `hidden` / `aria-hidden` / `display:none` / `visibility:hidden|collapse`,
disabled, inside an `[inert]` subtree, or `content-visibility:hidden`; or when real layout shows it
has no rendered box, no meaningful size, is fully off-canvas **horizontally**, or is fully clipped by
a non-document `overflow:hidden|clip` ancestor. It deliberately does **not** exclude controls merely
for being vertically above/below the viewport, for `opacity:0`, or for living inside a normal
scrollable (`overflow:auto|scroll`) area; `html`/`body` are never treated as clipping ancestors.

The geometry checks are pure helpers (`hasMeaningfulSize`, `isFullyOffCanvasHorizontally`,
`isClippedAwayBy`) unit-tested with mocked rectangles. They run only when `isLayoutAvailable` is true,
so layout-less environments (jsdom) fall back to DOM/style signals instead of hiding everything, and
the filter never throws on exotic/detached nodes (it defaults to keeping the control). The filter is
read-only and changes neither the scanner's focusability semantics nor the page's tab order. Because
the filter feeds `computeTabPath`, it applies uniformly to manual activation, popup-reopen reapply,
`This website`/`All websites` automatic checking, and SPA route refreshes; `totalDetected` and the
summary reflect the visible set.

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
tabPathEnabled, tabPathMaxItems }`. `MonitoringScope` is `off | current-tab | site | all-sites`;
  `tabPathMaxItems` is the user-chosen keyboard-path marker limit (`100 | 250 | 500`, default 100).
  Old stored settings without `tabPathMaxItems` are coerced to 100 on read via
  `normalizeTabPathMaxItems`, so existing users are never broken. The popup is the writer; the
  content script and background read it. No page content is ever stored.
- **Keyboard-path marker limit** is threaded through `createApplyMonitoringPayload` →
  `APPLY_MONITORING` (and `TOGGLE_TAB_PATH` for manual use) into `computeTabPath`'s `maxItems`, so
  the chosen limit applies to manual activation, immediate redraws when the limit changes while the
  path is visible, automatic-checking re-application after navigation, and SPA route refreshes.
  `totalDetected` always reflects the real detected count before the limit, so the popup can show
  "Showing all N keyboard items." or "Showing the first L of N keyboard items.".
- **Popup** owns the UX: Start/Stop, the scope selector, and the status label. On Start it persists
  `enabled`/`scope` only (the remembered helper preferences are preserved), requests an optional host
  permission when the scope needs one (from the click gesture), scans the active tab, and applies the
  remembered helpers via `APPLY_MONITORING`. On Stop it persists `enabled:false` and clears overlays
  **without** erasing the helper preferences (so the next Start restores them). When the popup opens
  while monitoring is enabled, it injects into the active tab and re-applies the remembered helpers —
  which is how monitoring re-applies on each page in the current-tab scope. Helper preferences are
  persisted whenever a toggle changes (`updateMonitoringHelperPreference`), independent of UI state.
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

## Release packaging (Phase 1A)

`pnpm release:all` runs `scripts/create-store-zips.mjs`, which builds the Chromium MV3 package via
WXT (`wxt zip`) and writes versioned, store-ready ZIPs to `artifacts/` (git-ignored):

- `artifacts/chrome/easy-web-navigation-chrome-v<version>.zip`
- `artifacts/edge/easy-web-navigation-edge-v<version>.zip` (the same Chromium MV3 package — Edge
  Add-ons accepts MV3)

The script validates that `manifest.json` is at each ZIP root (a Chrome/Edge requirement) using a
built-in ZIP central-directory parser — no external dependencies — and prints file sizes. It never
uploads anything; store submission is manual (see [store/](store/)).
