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
[ Popup ] --SCAN_REQUEST--> [ Background ] --(inject + relay)--> [ Content script ]
[ Popup ] <--SCAN_RESULT--- [ Background ] <--SCAN_RESULT------- [ Content script ]
```

- The popup initiates actions (scan, toggle focus helper, export).
- The background worker is the orchestrator: it injects the content script into the active tab
  (using `activeTab` + `scripting`) and relays messages.
- The content script performs read-only inspection and replies with a `ScanResult`.

In Phase 0A the content script returns a placeholder `ScanResult` and performs no analysis.

## Package responsibilities

| Package                     | Responsibility                                                      |
| --------------------------- | ------------------------------------------------------------------- |
| `@keywise/shared-types`     | Framework-agnostic type contracts shared everywhere.                |
| `@keywise/wcag-rules`       | WCAG 2.2 criteria + rule metadata catalog (no detection logic yet). |
| `@keywise/dom-scanner`      | Read-only DOM inspection that produces a `ScanResult`.              |
| `@keywise/keyboard-engine`  | Focus tracking and tab-path recording (observe, never override).    |
| `@keywise/focus-overlay`    | Optional, passive visual focus helper.                              |
| `@keywise/report-generator` | Renders a `ScanResult` to Markdown or JSON.                         |

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
