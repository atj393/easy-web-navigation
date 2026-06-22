# Changelog

All notable changes to Easy Web Navigation are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/), and the project aims to follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- Replaced the Easy Web Navigation production icon with the final user-provided brand artwork and regenerated all runtime, store, and GitHub asset variants.

### Changed — GitHub product presentation

- Reworked the public README and GitHub repository presentation to make Easy Web Navigation easier to understand for everyday users, testers, and teams.
- Aligned the product-documentation layout with the creator's Re-Phraser repository while retaining Easy Web Navigation's own privacy, permissions, and accessibility-inspection scope.
- No extension functionality, permissions, privacy behavior, or store availability changed.

## [1.0.0] — 2026-06-22

### Changed

- Prepared Easy Web Navigation for its first public production release on the Chrome Web Store and Microsoft Edge Add-ons.
- Replaced generated icon artwork with the official user-provided Easy Web Navigation icon.
- Updated production package assets, release documentation, store copy, and end-user-facing GitHub documentation.
- Rewrote the README to serve as the public product home for users, testers, and organisations.

### Security and privacy

- No permissions, tracking, analytics, remote calls, AI features, page mutations, automatic fixes, or compliance claims were added.

### Fixed — Phase 1A-UX-Visibility-Fix: hidden controls excluded from keyboard path

- Keyboard-path markers now exclude controls that are visually unavailable because they are collapsed, clipped, hidden, inert, or fully off-canvas.
- Normal page controls above or below the visible viewport remain part of the keyboard path.
- No scanner rules, permissions, page mutations, or tab-order behavior changed.

### Changed — Phase 1A-UX-Follow-up: clearer automatic checking and adjustable keyboard path

- Clarified that "This page only" may require reopening the extension after navigation.
- Added a locally saved keyboard-path marker limit with 100, 250, and 500 marker choices.
- Kept 100 markers as the recommended default to protect performance.
- No scanner rules, permissions, page changes, or automatic-fix behavior changed.

### Changed — Phase 1A-UX: clearer popup for everyday users

- Simplified popup wording, grouped actions by purpose, enlarged the popup, and added plain-language
  guidance for keyboard focus, keyboard path, and automatic checking.
- Plain-language labels now replace technical ones in the popup UI: "Check this page" (was "Scan
  current page"), "Show/Hide keyboard focus" (was focus helper), "Show/Hide keyboard path" (was tab
  path), "Show this problem" (was Locate), "Copy/Download results", and "Keep checking as you
  browse" / "This page only / This website / All websites" (was Monitoring / scope). The popup is
  ~420px wide with larger text and ≥44px primary buttons; light/dark behavior preserved.
- Added popup-only display helpers (`scopeChoiceLabel`, `automaticCheckingStatusLabel`,
  `scopeExplanation`) in `lib/monitoring.ts`; internal scope values and persisted keys are unchanged.
- No scanner, monitoring, permissions, or page-modification behavior changed.

### Changed — Phase 1A: production release-candidate hardening (store readiness)

- Prepared the extension as a production release candidate for the Chrome Web Store and Microsoft
  Edge Add-ons. No product features, scanner/overlay/monitoring behavior, or permissions changed.
- **Package cleanup:** moved `icon-source.svg` out of `public/` (package root) so it no longer ships
  in the store ZIP; set a clean store ZIP name (`easy-web-navigation`). Audited the runtime code —
  no debug logging, no dead code, no remote code, no analytics, no external network calls.
- **Release artifacts:** added `scripts/create-store-zips.mjs` (pure Node) and
  `pnpm release:all` / `release:inspect`. They build + package the Chromium MV3 zip and copy it to
  `artifacts/chrome/easy-web-navigation-chrome-v0.1.0.zip` and
  `artifacts/edge/easy-web-navigation-edge-v0.1.0.zip` (Edge = same MV3 build), validating that
  `manifest.json` is at each ZIP root. `artifacts/` is git-ignored.
- **Store documentation** under `docs/store/`: Chrome and Edge listings, privacy policy + privacy
  disclosure, permission justifications, reviewer test instructions, screenshot plan, a release
  checklist, a required manual-QA checklist, and v0.1.0 release notes. Added a top-level
  `docs/privacy-policy.md` pointer.
- **Store assets:** generated original brand artwork (`docs/store/assets/chrome-small-promo-440x280.png`,
  `edge-logo-300x300.png`) via `scripts/generate-store-assets.mjs`. Product screenshots are a
  labeled placeholder + plan (real captures required before submission — not faked).

### Fixed — Phase 0H-Fix: monitoring helper-preference persistence & auto-apply

- Monitoring now actually re-applies the remembered Focus helper / Tab path on each supported page.
  Previously, after navigating you had to click the toggles again.
- **Root causes fixed:** (1) opening the popup while monitoring was on only _read_ helper state
  (no injection), so nothing re-applied — especially in the current-tab scope where the background
  cannot inject; (2) **Start** overwrote the saved helper preferences from popup UI state and
  **Stop** reset the popup toggles, so a Stop→Start cycle silently lost the preferences;
  (3) the SPA route refresh used stale in-memory values.
- **Popup:** on open, if monitoring is enabled it injects into the active tab (popup open is a user
  gesture), re-applies the remembered helpers, and scans — so helpers reappear automatically.
  **Start** now only sets `enabled`/`scope` and preserves the remembered helper preferences, then
  applies them; **Stop** keeps the preferences for the next Start.
- **Content script:** `refreshForRoute` reads the latest saved preferences from storage on every SPA
  route change (no stale values).
- Clearer wording: monitoring "remembers your Focus helper and Tab path choices"; the current-tab
  scope explains it may stop after cross-origin navigation (choose This site / All supported
  websites for automatic scanning across pages).
- Added pure, tested helpers in `lib/monitoring.ts`: `mergeMonitoringSettings`,
  `updateMonitoringHelperPreference`, `createApplyMonitoringPayload`, `shouldAutoApplyHelpers`.
- No new permissions, no page mutation, read-only throughout.

### Added — Phase 0H: SPA route-change monitoring

- While monitoring is active, Easy Web Navigation now detects single-page-app route changes and
  refreshes (read-only) without a full navigation or a manual scan.
- New helper `apps/extension/lib/spa-monitoring.ts`: `normalizeRouteSnapshot`, `hasRouteChanged`,
  `createThrottledRouteRefresh`, `createSpaRouteMonitor`, and `DEFAULT_SPA_REFRESH_DELAY_MS` (400ms).
- Detection signals: `history.pushState` / `history.replaceState` (safely wrapped — originals are
  called through with correct `this`, wrappers are marked to avoid double-wrapping and restored on
  stop), plus `popstate` and `hashchange`. No always-on heavy MutationObserver.
- Refreshes are **trailing-debounced**: a burst of route signals collapses into a single refresh.
  On refresh the overlay is re-established on the (possibly replaced) DOM, the enabled helpers are
  re-applied (tab path recomputed), and one read-only scan runs.
- Lifecycle is tied to monitoring: the content script starts the monitor on load when monitoring is
  enabled and via a `local:monitoring` storage watch; stopping monitoring stops the monitor and
  clears overlays. Fully cleanup-safe.
- Popup shows "Active · SPA route changes refresh automatically." while monitoring is on.
- Read-only throughout: no page mutation, no new permissions, no analytics, no external/AI calls.
- Added `MonitoringRefreshReason` type and 14 unit tests (route snapshot, change detection,
  throttle, push/replace/popstate/hashchange handling, no-double-wrap, idempotent start, cleanup).

### Added — Phase 0G: user-controlled monitoring mode

- Added an explicit, user-started **monitoring mode**: a **Start / Stop** control plus a scope
  selector (`Current tab session`, `This site`, `All supported websites`) and a live
  "Monitoring: …" status label. Default scope is current tab; monitoring is off until started.
- On **Start**: persists the choice, requests an optional host permission when the scope needs one,
  scans the current page immediately, and re-applies the remembered visual helpers (focus helper /
  tab path). On **Stop**: turns monitoring off and removes active overlays. Manual scanning and all
  existing controls are unchanged.
- **Permission model** (no required broad host permissions): added
  `optional_host_permissions: ["http://*/*","https://*/*"]`. `current-tab` uses `activeTab` only;
  `site` requests the current origin (`https://host/*`); `all-sites` requests the broad patterns —
  only after the user clicks Start. If a request is denied, monitoring falls back to the current-tab
  session with a friendly message.
- **Background** auto-injects the read-only content script on navigation (event-driven
  `tabs.onUpdated`, no polling) only for `site` / `all-sites` scopes and only for tabs covered by a
  granted host permission. No `tabs` permission is used.
- **Content script** reads monitoring settings on load and re-applies the remembered helpers
  (read-only); added an `APPLY_MONITORING` message. Restricted/privileged pages are never scanned
  (`isSupportedPageUrl`).
- Persisted monitoring state (`local:monitoring`): `enabled`, `scope`, `focusHelperEnabled`,
  `tabPathEnabled`. No page content is stored or uploaded; no analytics; no external/AI calls.
- Added shared types (`MonitoringScope`, `MonitoringSettings`, `PermissionRequestResult`,
  `MonitoringStartResult`, `DEFAULT_MONITORING`) and pure, unit-tested helpers
  (`isSupportedPageUrl`, `originPatternFromUrl`, `hostPermissionsForScope`, `scopeLabel`).

### Added — Phase 0F: portfolio & presentation polish

- Added original extension icons (16/32/48/128 PNG) plus `icon-source.svg`, generated by a
  dependency-free Node script (`apps/extension/scripts/generate-icons.mjs`) and committed. Icons are
  wired into the manifest `icons` and `action.default_icon`; permissions are unchanged.
- Polished the popup: brand header with icon, a severity legend (critical / serious / moderate /
  minor), a clearer empty state, a dedicated error/alert box, and a grouped tools row. Behavior is
  unchanged and still read-only.
- Polished the options page to match the popup, with per-setting hints and a clear "not wired yet"
  tag for preferences reserved for future phases (no behavior change).
- Rewrote `docs/demo-plan.md` with a concrete 60-second demo script and added
  `docs/assets/README.md` describing where screenshots/GIFs will live.
- Updated the README screenshots/demo section to point at `docs/assets/` and the icon source.

### Added — Phase 0P: public open-source standardization

- Standardized the repository for a public GitHub release as `atj393/easy-web-navigation`.
- Added community health files: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1),
  `SECURITY.md` (private reporting + privacy posture), and `SUPPORT.md`.
- Added GitHub issue templates (`bug_report`, `feature_request`, `accessibility_rule`, `config`) and
  a pull-request template with a full quality/scope checklist.
- Polished the README into a portfolio-ready document: badges, audience, browser-permissions table,
  privacy & security notes, packages table, screenshots/demo placeholder, and community footer.
- Added `repository`, `bugs`, and `homepage` metadata to the root `package.json`.
- CI workflow now also runs the Firefox build and declares least-privilege `contents: read`.
- No product behavior, scanner/overlay/report logic, or permissions changed.

### Added — Phase 0E: developer report export

- Reworked the Markdown report (`@easy-web-navigation/report-generator`) into clean sections:
  title, report type, Page (title/URL/scanned/focusable count), Summary (by severity + by
  category), Issues (WCAG refs, rule, selector, element preview, runtime-observable note, why,
  recommendation), and a prominent Disclaimer.
- Restructured the JSON report to a stable shape: `productName`, `profile`, `reportType`,
  `schemaVersion`, `disclaimer`, `generatedAt`, `page`, `summary`, `issues` (+ `tabPathSummary`
  only when provided).
- Strengthened the report disclaimer: "…does not certify legal compliance… A clean report is not a
  compliance pass. Full accessibility requires source-level remediation, manual testing, and user
  testing with assistive technologies."
- Optional tab-path summary in the report, clearly labeled "Runtime visual aid only — not an audit
  metric" (`shown` / `totalDetected` / `capped`). Added a `ReportOptions` type.
- Popup: split export into **Copy Markdown report** (clipboard) and **Download Markdown report**,
  with status messages. Added a read-only, injectable `copyTextToClipboard` helper that prefers
  `navigator.clipboard.writeText` and falls back to a temporary off-screen textarea +
  `document.execCommand("copy")` inside the popup document.
- Tests: report Markdown/JSON content (incl. tab-path summary present/absent) and clipboard helper
  (async API, fallback, rejection, failure). Vitest now also discovers `apps/**/lib/**/*.test.ts`.

### Changed — Phase 0N: project rename

- Renamed the project from **KeyWise Web** to **Easy Web Navigation** (rename-only phase; no
  feature, permission, or logic changes beyond rename-driven imports/config).
- Repository slug is now `easy-web-navigation`; internal package scope is now
  `@easy-web-navigation` (e.g. `@easy-web-navigation/shared-types`, `.../dom-scanner`,
  `.../keyboard-engine`, `.../focus-overlay`, `.../report-generator`, `.../wcag-rules`).
- Updated the extension display name, popup/options UI, README, docs, package metadata, internal
  identifiers (`__easyWebNavigationInitialized`, `data-easy-web-navigation-overlay`), and the
  exported report tool name to **Easy Web Navigation**.
- Added `PRODUCT_NAME` / `PRODUCT_TAGLINE` constants to `@easy-web-navigation/shared-types`.

### Added — Phase 0D: read-only tab-path visualization

- `@easy-web-navigation/keyboard-engine`: `computeTabPath`, `sortFocusableElementsForTabOrder`,
  `createTabPathSummary`, and `resolveTabIndex`. Reuses `@easy-web-navigation/dom-scanner` focusable detection.
  Ordering: positive `tabindex` first (ascending, ties keep DOM order), then `tabindex=0` /
  natural in DOM order; negative `tabindex`, hidden, and disabled elements are excluded.
- Large-page guard: results are capped (default 100 items) with `totalDetected` / `capped` reported.
- `@easy-web-navigation/focus-overlay`: `showTabPath`, `clearTabPath`, `getTabPathState`, and `hasContent`.
  Numbered markers + dashed outlines drawn in the existing extension-owned, shadow-isolated,
  `pointer-events:none` container; rAF-repositioned on scroll/resize; disconnected-safe.
- New typed messages: `TOGGLE_TAB_PATH`, `GET_TAB_PATH_STATE`, `TAB_PATH_RESULT`; new types
  `TabPathItem`, `TabPathSummary`, `TabPathOptions`, `TabPathResult`.
- Content script owns tab-path state; the overlay stays mounted while the focus helper or tab path
  needs it and unmounts only when nothing remains.
- Popup: "Show/Hide tab path" toggle with a summary line (shown / total detected) and a capped
  warning; focus helper, scan, locate, and export behavior unchanged.

### Notes

- Tab path is a read-only visual aid computed from currently detectable focusable elements; it does
  not change tab order and is not a guarantee of exact browser/AT behavior in every edge case.

### Added — Phase 0C: read-only focus helper and issue locator

- Implemented `FocusOverlayController` in `@easy-web-navigation/focus-overlay`: `mount`, `unmount`, `isMounted`,
  `highlightElement`, `clearHighlight`, `clearAll`, `updateForElement`, and `destroy`.
- The overlay uses one extension-owned, shadow-isolated, `pointer-events:none`, `aria-hidden`
  container; positions boxes from `getBoundingClientRect()`; repositions on scroll/resize
  (rAF-throttled); and cleans up fully on unmount/destroy. It never mutates inspected nodes.
- Content script owns the controller, tracks keyboard focus read-only (capture-phase `focusin`),
  and resolves a "locate" selector (best-effort, with a one-level open shadow-DOM fallback).
- New typed messages: `TOGGLE_FOCUS_HELPER`, `GET_FOCUS_HELPER_STATE`, `FOCUS_HELPER_STATE`,
  `LOCATE_ISSUE`, `LOCATE_RESULT` (replacing the unused `FOCUS_HELPER_TOGGLE`).
- Popup: "Show/Hide focus helper" toggle (with state sync on open), a per-issue "Locate on page"
  action that temporarily highlights the element (~2s) and scrolls it into view on click, and a
  small locate status line.

### Notes

- The overlay is visual-only: it does not fix source accessibility and is not a compliance result.
- `missing-visible-focus` remains deferred — Phase 0C provides a focus helper but does not score
  native focus visibility.

### Added — Phase 0B: read-only scanner and first rules

- Real, read-only DOM scanner in `@easy-web-navigation/dom-scanner`: `createScanContext`,
  `collectFocusableElements`, `getStableSelector`, `getElementPreview`, accessible-name and
  visibility/focusability helpers, open shadow-root traversal, and a structured `scanDocument`.
- Six deterministic WCAG keyboard-profile rules wired into the scan (all DOM-observable only):
  `clickable-not-focusable`, `unlabeled-control`, `unlabeled-form-input`, `positive-tabindex`,
  `missing-main-landmark`, `missing-skip-link`. `missing-visible-focus` remains deferred metadata.
- Rules are injected with a `RuleContext` from the scanner, avoiding a package dependency cycle.
- Extended `A11yIssue` (title, description, wcag, level, recommendation, canAutoEnhance) and
  `ScanResult` (url, title, scannedAt, profile, summary counts by severity/category/rule).
- Content script performs a real read-only scan and returns `SCAN_RESULT` / `SCAN_ERROR`.
- Popup runs a scan against the active tab (activeTab + scripting), renders summary cards, an issue
  list (severity, WCAG refs, selector, recommendation), and a Markdown report export.
- Report generator emits real issue data with WCAG references and the non-compliance disclaimer.
- Tests now run under jsdom; added scanner, per-rule, and report coverage (39 tests).

### Changed

- `canAutoEnhance` is always `false` in Phase 0B (no runtime page changes).

### Added — Phase 0A: skeleton initialization

- pnpm + TypeScript monorepo (`pnpm-workspace.yaml`, shared `tsconfig.base.json`).
- WXT + React + Manifest V3 extension under `apps/extension` with `background`, `content`,
  `popup`, and `options` entrypoints.
- Minimal Phase 0A permissions: `activeTab`, `scripting`, `storage` (no broad host permissions).
- Six workspace packages with documented placeholders: `@easy-web-navigation/shared-types`,
  `@easy-web-navigation/wcag-rules`, `@easy-web-navigation/dom-scanner`, `@easy-web-navigation/keyboard-engine`,
  `@easy-web-navigation/focus-overlay`, `@easy-web-navigation/report-generator`.
- WCAG 2.2 keyboard-profile criteria and seven placeholder rules (all `not-implemented`).
- Static demo pages under `apps/demo-sites`.
- Documentation: README, architecture, WCAG keyboard profile, limitations, roadmap, demo plan.
- Vitest unit tests for shared types, rule metadata, the scanner placeholder, and report output.
- ESLint flat config, Prettier config, and a GitHub Actions CI workflow.

### Notes

- No AI, no speech, no overlays, no automatic DOM fixes.
- No legal compliance is claimed.
