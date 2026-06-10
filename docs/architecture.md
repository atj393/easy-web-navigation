# Architecture

> Phase 0A documents the intended architecture. Most behavior described here is represented by
> placeholders in the current code.

## Extension architecture

KeyWise Web is a Manifest V3 WebExtension built with [WXT](https://wxt.dev) and React. It targets
Chromium (Chrome, Edge) and Firefox from a single codebase. There are four entrypoints:

- **Background service worker** (`entrypoints/background.ts`) — orchestration only. Routes typed
  messages; never touches the DOM and never makes network requests.
- **Content script** (`entrypoints/content.ts`) — read-only page inspection, injected on demand.
- **Popup** (`entrypoints/popup/`) — React UI for running inspections and viewing summaries.
- **Options** (`entrypoints/options/`) — React UI for user settings, persisted via typed storage.

## Popup ⇄ content ⇄ background messaging

All cross-surface communication uses the typed `ExtensionMessage` union from
`@keywise/shared-types`, so every message is discriminated on its `type` field.

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

The focus helper and issue locator share one `FocusOverlayController` (`@keywise/focus-overlay`),
instantiated and owned by the content script:

- It appends **one** extension-owned `<div>` to `document.body` with an **open shadow root** for
  style isolation. The container is `position:fixed`, `pointer-events:none`, max `z-index`, and
  `aria-hidden="true"`, so it cannot steal focus, block input, or be seen by assistive technology.
- Highlights are absolutely/fixed-positioned boxes computed from `getBoundingClientRect()`, keyed by
  id (`focus` for the live focused element, `locate` for a temporary issue highlight).
- Scroll and resize reposition the boxes (rAF-throttled); disconnected elements auto-clear.
- It **never** touches inspected nodes — no attributes, classes, wrapping, moving, or listeners on
  them. `unmount()`/`destroy()` removes the container, all window listeners, and all timers.

## Package responsibilities

| Package                     | Responsibility                                                        |
| --------------------------- | --------------------------------------------------------------------- |
| `@keywise/shared-types`     | Framework-agnostic type contracts shared everywhere.                  |
| `@keywise/wcag-rules`       | WCAG 2.2 criteria + rule metadata catalog (no detection logic yet).   |
| `@keywise/dom-scanner`      | Read-only DOM inspection that produces a `ScanResult`.                |
| `@keywise/keyboard-engine`  | Read-only tab-order computation (reuses dom-scanner focusable logic). |
| `@keywise/focus-overlay`    | Read-only overlay: focus helper, issue locator, tab-path markers.     |
| `@keywise/report-generator` | Renders a `ScanResult` to Markdown or JSON.                           |

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
