# Changelog

All notable changes to KeyWise Web are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/), and the project aims to follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added — Phase 0C: read-only focus helper and issue locator

- Implemented `FocusOverlayController` in `@keywise/focus-overlay`: `mount`, `unmount`, `isMounted`,
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

- Real, read-only DOM scanner in `@keywise/dom-scanner`: `createScanContext`,
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
- Six workspace packages with documented placeholders: `@keywise/shared-types`,
  `@keywise/wcag-rules`, `@keywise/dom-scanner`, `@keywise/keyboard-engine`,
  `@keywise/focus-overlay`, `@keywise/report-generator`.
- WCAG 2.2 keyboard-profile criteria and seven placeholder rules (all `not-implemented`).
- Static demo pages under `apps/demo-sites`.
- Documentation: README, architecture, WCAG keyboard profile, limitations, roadmap, demo plan.
- Vitest unit tests for shared types, rule metadata, the scanner placeholder, and report output.
- ESLint flat config, Prettier config, and a GitHub Actions CI workflow.

### Notes

- No AI, no speech, no overlays, no automatic DOM fixes.
- No legal compliance is claimed.
