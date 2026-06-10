# Changelog

All notable changes to Easy Web Navigation are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/), and the project aims to follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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
