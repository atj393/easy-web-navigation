# Easy Web Navigation

> A keyboard accessibility companion for the web.

[![CI](https://github.com/atj393/easy-web-navigation/actions/workflows/ci.yml/badge.svg)](https://github.com/atj393/easy-web-navigation/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-149eca.svg)](https://react.dev/)
[![WXT](https://img.shields.io/badge/WXT-MV3-67d75b.svg)](https://wxt.dev/)
[![WCAG 2.2](https://img.shields.io/badge/WCAG-2.2%20A%2FAA-005a9c.svg)](https://www.w3.org/TR/WCAG22/)

**Repository:** https://github.com/atj393/easy-web-navigation

Easy Web Navigation is an open-source browser extension for **Chrome, Edge, and Firefox** that helps
users and developers inspect keyboard accessibility, focus visibility, tab order, navigation
structure, and accessible names on web pages. It is an **inspection and assistive browsing tool** —
not an overlay, not an automatic website fixer, and not a compliance certifier.

## Who it's for

- **Front-end developers** who want to spot keyboard issues while building, without leaving the page.
- **QA and accessibility testers** who need a fast, read-only first pass and a shareable report.
- **Keyboard-only users** who want to see where focus goes and how a page is structured.

It complements — and never replaces — manual testing and testing with real assistive technologies.

## Why this exists

Keyboard accessibility is one of the most common — and most fixable — barriers on the web. Yet most
developers and many users have no quick way to _see_ how a page behaves for keyboard-only navigation:
where focus goes, whether it is visible, whether controls have names, and whether the page can be
navigated at all without a mouse. Easy Web Navigation aims to make that experience visible and inspectable,
directly in the browser.

## Primary standard

**WCAG 2.2 — Level A and AA — Keyboard and Navigation Profile.**

Target success criteria:

| Criterion | Name                         | Level |
| --------- | ---------------------------- | ----- |
| 2.1.1     | Keyboard                     | A     |
| 2.1.2     | No Keyboard Trap             | A     |
| 2.4.1     | Bypass Blocks                | A     |
| 2.4.3     | Focus Order                  | A     |
| 2.4.6     | Headings and Labels          | AA    |
| 2.4.7     | Focus Visible                | AA    |
| 2.4.11    | Focus Not Obscured (Minimum) | AA    |
| 3.3.2     | Labels or Instructions       | A     |
| 4.1.2     | Name, Role, Value            | A     |

## v0 scope (through Phase 0H)

A pnpm + TypeScript monorepo with a working **read-only** keyboard accessibility scanner, a
read-only visual focus helper / issue locator, a read-only tab-path visualization, a
developer-friendly report export, and an explicit, user-controlled monitoring mode.

### What v0 does

- Establishes a pnpm + TypeScript monorepo with a WXT + React + Manifest V3 extension.
- Runs a **read-only DOM scan** of the active tab (on the popup's "Check this page" button) and
  reports real issues for six deterministic WCAG keyboard-profile rules:
  `clickable-not-focusable`, `unlabeled-control`, `unlabeled-form-input`, `positive-tabindex`,
  `missing-main-landmark`, and `missing-skip-link`.
- Displays a summary and an issue list (severity, WCAG references, selector, recommendation).
- Offers a **developer-friendly report**: **Copy results** (clipboard, with a textarea
  fallback) and **Download results**, plus a stable JSON report shape. Reports carry a
  prominent non-compliance disclaimer and can optionally include the tab-path summary, clearly
  labeled as a runtime visual aid (not an audit metric).
- Offers a **read-only keyboard focus highlight**: toggle it on and a rectangle tracks the
  keyboard-focused element as you Tab. Each issue has a **"Show this problem"** action that
  temporarily highlights its element. The overlay is extension-owned, isolated, and never modifies
  the page.
- Offers a **read-only keyboard path view**: toggle "Show keyboard path" to draw numbered markers in
  the computed keyboard tab order (positive `tabindex` first, then DOM order), with a summary that
  reports the real number of keyboard items detected. A simple **Number of keyboard path markers**
  control lets you choose 100 (recommended), 250, or 500 markers; the choice is saved, redraws an
  already-visible path immediately, and is reused during automatic checking. 100 stays the default to
  protect performance, and the limit is capped at 500.
- Offers an explicit, user-started **automatic checking** mode (in the popup, "Keep checking as you
  browse"): click **Start automatic checking** and Easy Web Navigation checks supported pages
  automatically and re-applies the visual guides you enabled, within the scope you choose —
  _this page only_ (no new permission), _this website_, or _all websites_ (the latter two request an
  **optional** host permission first, only on your action). While it is on it also detects
  **single-page-app route changes** (History API, `popstate`, `hashchange`) and refreshes in a
  throttled, read-only way. **Stop automatic checking** turns it off and clears overlays. It never
  uploads page content or changes the website.
- Includes static demo pages, documentation, tests (jsdom), and CI.

### What v0 does NOT do

- No DOM mutation of inspected nodes, no auto-fix, no ARIA injection (strictly read-only; the only
  DOM it creates is its own isolated overlay container, fully removed when nothing needs it).
- No assist mode yet (no changing tab order, focus, or keyboard behavior).
- No `missing-visible-focus` detection yet (kept as deferred metadata): the keyboard focus highlight
  shows where focus goes, but does not score whether the page's own focus indicator is sufficient.
- No AI. No speech. Not an accessibility overlay product.
- No legal compliance claims of any kind. A clean scan is **not** a pass.
- No broad host permissions (`<all_urls>` is **not** requested).

## Setup

```bash
pnpm install
pnpm dev            # Chrome/Edge dev build (WXT)
pnpm dev:firefox    # Firefox dev build
```

## Scripts

| Script                 | Description                                      |
| ---------------------- | ------------------------------------------------ |
| `pnpm dev`             | Run the extension in development (Chromium).     |
| `pnpm dev:firefox`     | Run the extension in development (Firefox).      |
| `pnpm build`           | Production build (Chromium / MV3).               |
| `pnpm build:firefox`   | Production build (Firefox).                      |
| `pnpm typecheck`       | Type-check every workspace package.              |
| `pnpm lint`            | Lint the repository with ESLint.                 |
| `pnpm test`            | Run the Vitest unit tests.                       |
| `pnpm format`          | Format the repository with Prettier.             |
| `pnpm run ci`          | typecheck → lint → test → build.                 |
| `pnpm release:all`     | Build + package store ZIPs into `artifacts/`.    |
| `pnpm release:inspect` | Validate existing store ZIPs (manifest at root). |

> Note: use `pnpm run ci` (not `pnpm ci`) — `ci` is a reserved pnpm command.

## Releases & store submission

`pnpm release:all` builds the Chromium MV3 package and writes versioned, store-ready ZIPs
(`manifest.json` at the root) to `artifacts/`:

- `artifacts/chrome/easy-web-navigation-chrome-v<version>.zip` — Chrome Web Store
- `artifacts/edge/easy-web-navigation-edge-v<version>.zip` — Microsoft Edge Add-ons (same Chromium MV3 build)

Artifacts are git-ignored (regenerate any time). Submission is **manual** — copy-paste-ready store
listings, privacy policy, permission justifications, reviewer test instructions, a release checklist,
and a required manual-QA checklist live in [`docs/store/`](docs/store/). Privacy policy:
[`docs/store/privacy-policy.md`](docs/store/privacy-policy.md).

## Architecture overview

A pnpm workspace with one extension app and six focused packages:

```
apps/
  extension/        WXT + React + MV3 extension (popup, options, background, content)
  demo-sites/       Static HTML pages for manual keyboard testing
packages/
  shared-types/     Framework-agnostic type contracts and message types
  wcag-rules/       WCAG criteria + rule metadata and deterministic rule evaluators
  dom-scanner/      Read-only DOM inspection that produces a ScanResult
  keyboard-engine/  Read-only tab-order computation (reuses dom-scanner detection)
  focus-overlay/    Read-only visual overlay (focus helper, issue locator, tab markers)
  report-generator/ Markdown + JSON report output
```

See [docs/architecture.md](docs/architecture.md) for messaging flow and the permissions/security
approach.

## Packages

| Package                                                              | Responsibility                                                                |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [`@easy-web-navigation/shared-types`](packages/shared-types)         | Framework-agnostic type contracts and the typed message envelope.             |
| [`@easy-web-navigation/wcag-rules`](packages/wcag-rules)             | WCAG 2.2 criteria + rule metadata and the deterministic rule evaluators.      |
| [`@easy-web-navigation/dom-scanner`](packages/dom-scanner)           | Read-only DOM inspection, accessible-name and focusable detection.            |
| [`@easy-web-navigation/keyboard-engine`](packages/keyboard-engine)   | Read-only keyboard tab-order computation.                                     |
| [`@easy-web-navigation/focus-overlay`](packages/focus-overlay)       | Extension-owned, isolated visual overlay (focus helper, locate, tab markers). |
| [`@easy-web-navigation/report-generator`](packages/report-generator) | Markdown and JSON report rendering.                                           |

## Browser permissions

Easy Web Navigation requests the **minimum** permissions needed and **no broad host permissions**:

| Permission  | Why                                                                |
| ----------- | ------------------------------------------------------------------ |
| `activeTab` | Inspect the current tab only when you invoke the extension.        |
| `scripting` | Inject the read-only content script into the active tab on demand. |
| `storage`   | Persist your options (e.g. focus-helper preference) locally.       |

No broad host permissions are **required**. For automatic monitoring of a whole site or all
websites, Easy Web Navigation declares **optional** host permissions (`http://*/*`, `https://*/*`)
that are requested **only when you choose that scope and click Start automatic checking** — never at
install time, and never as a requirement for manual scanning. The content script is registered at
runtime and injected only into the active tab (or, while monitoring with a granted scope, into
matching tabs you navigate to).

## Privacy & security

- **No data collection, no analytics, no telemetry.** Nothing is tracked.
- **No remote API calls and no AI calls.** All analysis runs locally in your browser.
- **No page content is uploaded** anywhere. Reports are generated locally and stay with you
  (copied to your clipboard or downloaded as a file) until you choose to share them.
- **No speech, no recording.**
- **Read-only.** The extension never modifies inspected page nodes; the only DOM it creates is its
  own isolated overlay container, fully removed when not in use.
- **Monitoring is opt-in.** It only runs when you explicitly start it, and all-sites monitoring
  requires you to approve an optional host permission first.

See [SECURITY.md](SECURITY.md) for the security policy and how to report a vulnerability.

## Screenshots & demo

> Screenshots and a short demo GIF will live in [docs/assets/](docs/assets/README.md) (none committed
> yet). For now, load the extension in development (`pnpm dev`), serve the [demo pages](#demo-pages),
> and follow the 60-second walkthrough in [docs/demo-plan.md](docs/demo-plan.md).

The toolbar icon is original artwork generated from
[`apps/extension/icon-source.svg`](apps/extension/icon-source.svg).

## Demo pages

Static pages under [apps/demo-sites/](apps/demo-sites/) provide good and deliberately broken
keyboard experiences for testing:

- `semantic-good-page` — clean baseline.
- `broken-keyboard-page` — removed focus outline + positive tabindex.
- `fake-buttons-page` — `div`s pretending to be buttons.
- `modal-focus-trap-page` — a dialog for testing keyboard traps.
- `form-labels-page` — labeled vs. unlabeled inputs.

## Accessibility & compliance disclaimer

Easy Web Navigation helps inspect keyboard accessibility at runtime. **It does not certify legal
compliance** with WCAG, BITV, EN 301 549, the European Accessibility Act (EAA), the ADA, or
Section 508. **A clean report is not a compliance pass.** Full accessibility requires source-level
remediation, manual testing, and user testing with assistive technologies. See
[docs/limitations.md](docs/limitations.md).

## Roadmap

- **v0.1** — repository skeleton ✅
- **v0.2** — DOM scanner ✅
- **v0.3** — focus helper ✅
- **v0.4** — tab-path visualization ✅
- **v0.5** — developer report export ✅
- **v1.0** — portfolio release (in progress)

See [docs/roadmap.md](docs/roadmap.md).

## Technical highlights

- pnpm monorepo with strict TypeScript and clear package boundaries.
- WXT-based Manifest V3 extension targeting Chromium and Firefox from one codebase.
- Minimal-permission design: `activeTab` + `scripting` + `storage`, no broad host access.
- Typed message passing between extension surfaces.
- ESLint (flat config) + Prettier + Vitest + GitHub Actions CI.
- Careful, honest positioning: an inspection/assistive tool, not an overlay or compliance product.

## Contributing

Contributions are welcome. Good first areas include scanner rules, test coverage, demo pages,
documentation, and browser-compatibility fixes. Please read [CONTRIBUTING.md](CONTRIBUTING.md) for
setup, scope, workflow, and the pull-request checklist before opening a PR.

## Code of Conduct

This project follows a [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold
it.

## Security

Please do **not** open public issues for exploitable vulnerabilities. See [SECURITY.md](SECURITY.md)
for how to report privately and for the project's privacy posture.

## Support

For bugs and feature requests, see [SUPPORT.md](SUPPORT.md) and open a GitHub issue using the
provided templates.

## License

Released under the [MIT License](LICENSE). Copyright (c) 2026 atj393.
