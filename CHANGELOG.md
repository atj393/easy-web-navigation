# Changelog

All notable changes to KeyWise Web are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/), and the project aims to follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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
