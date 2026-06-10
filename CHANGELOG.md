# Changelog

All notable changes to KeyWise Web are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/), and the project aims to follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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
