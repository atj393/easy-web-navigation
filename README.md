# Easy Web Navigation

A keyboard accessibility companion for the web — for Chrome, Edge, and Firefox.

Easy Web Navigation is an open-source browser extension that helps users and developers inspect
keyboard accessibility, focus visibility, tab order, navigation structure, and accessible names on
web pages. It is an **inspection and assistive browsing tool** — not an overlay, not an automatic
website fixer, and not a compliance certifier.

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

## v0 scope (through Phase 0E)

A pnpm + TypeScript monorepo with a working **read-only** keyboard accessibility scanner, a
read-only visual focus helper / issue locator, a read-only tab-path visualization, and a
developer-friendly report export.

### What v0 does

- Establishes a pnpm + TypeScript monorepo with a WXT + React + Manifest V3 extension.
- Runs a **read-only DOM scan** of the active tab (on the popup's "Scan current page" button) and
  reports real issues for six deterministic WCAG keyboard-profile rules:
  `clickable-not-focusable`, `unlabeled-control`, `unlabeled-form-input`, `positive-tabindex`,
  `missing-main-landmark`, and `missing-skip-link`.
- Displays a summary and an issue list (severity, WCAG references, selector, recommendation).
- Offers a **developer-friendly report**: **Copy Markdown report** (clipboard, with a textarea
  fallback) and **Download Markdown report**, plus a stable JSON report shape. Reports carry a
  prominent non-compliance disclaimer and can optionally include the tab-path summary, clearly
  labeled as a runtime visual aid (not an audit metric).
- Offers a **read-only focus helper**: toggle it on and a rectangle tracks the keyboard-focused
  element as you Tab. Each issue has a **"Locate on page"** action that temporarily highlights its
  element. The overlay is extension-owned, isolated, and never modifies the page.
- Offers a **read-only tab-path visualization**: toggle "Show tab path" to draw numbered markers in
  the computed keyboard tab order (positive `tabindex` first, then DOM order), with a summary and a
  performance cap (default 100 items).
- Includes static demo pages, documentation, tests (jsdom), and CI.

### What v0 does NOT do

- No DOM mutation of inspected nodes, no auto-fix, no ARIA injection (strictly read-only; the only
  DOM it creates is its own isolated overlay container, fully removed when nothing needs it).
- No assist mode yet (no changing tab order, focus, or keyboard behavior).
- No `missing-visible-focus` detection yet (kept as deferred metadata): the focus helper shows where
  focus goes, but does not score whether the page's own focus indicator is sufficient.
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

| Script               | Description                                  |
| -------------------- | -------------------------------------------- |
| `pnpm dev`           | Run the extension in development (Chromium). |
| `pnpm dev:firefox`   | Run the extension in development (Firefox).  |
| `pnpm build`         | Production build (Chromium / MV3).           |
| `pnpm build:firefox` | Production build (Firefox).                  |
| `pnpm typecheck`     | Type-check every workspace package.          |
| `pnpm lint`          | Lint the repository with ESLint.             |
| `pnpm test`          | Run the Vitest unit tests.                   |
| `pnpm format`        | Format the repository with Prettier.         |
| `pnpm run ci`        | typecheck → lint → test → build.             |

> Note: use `pnpm run ci` (not `pnpm ci`) — `ci` is a reserved pnpm command.

## Architecture overview

A pnpm workspace with one extension app and six focused packages:

```
apps/
  extension/        WXT + React + MV3 extension (popup, options, background, content)
  demo-sites/       Static HTML pages for manual keyboard testing
packages/
  shared-types/     Framework-agnostic type contracts
  wcag-rules/       WCAG criteria + rule metadata (placeholders)
  dom-scanner/      Read-only DOM inspection (placeholders)
  keyboard-engine/  Focus tracking + tab-path recording (skeletons)
  focus-overlay/    Optional visual focus helper (skeleton)
  report-generator/ Markdown + JSON report output
```

See [docs/architecture.md](docs/architecture.md) for messaging flow and the permissions/security
approach.

## Demo pages

Static pages under [apps/demo-sites/](apps/demo-sites/) provide good and deliberately broken
keyboard experiences for testing:

- `semantic-good-page` — clean baseline.
- `broken-keyboard-page` — removed focus outline + positive tabindex.
- `fake-buttons-page` — `div`s pretending to be buttons.
- `modal-focus-trap-page` — a dialog for testing keyboard traps.
- `form-labels-page` — labeled vs. unlabeled inputs.

## Compliance disclaimer

Easy Web Navigation helps inspect keyboard accessibility at runtime. **It does not certify legal compliance**
with WCAG, BITV, EN 301 549, the European Accessibility Act (EAA), the ADA, or Section 508. Runtime
inspection can surface issues and aid understanding, but it cannot guarantee conformance, and it is
not a substitute for manual testing or expert review. See [docs/limitations.md](docs/limitations.md).

## Roadmap

- **v0.1** — repository skeleton (this phase)
- **v0.2** — DOM scanner
- **v0.3** — focus helper
- **v0.4** — tab-path visualization
- **v0.5** — developer report export
- **v1.0** — portfolio release

See [docs/roadmap.md](docs/roadmap.md).

## Technical highlights

- pnpm monorepo with strict TypeScript and clear package boundaries.
- WXT-based Manifest V3 extension targeting Chromium and Firefox from one codebase.
- Minimal-permission design: `activeTab` + `scripting` + `storage`, no broad host access.
- Typed message passing between extension surfaces.
- ESLint (flat config) + Prettier + Vitest + GitHub Actions CI.
- Careful, honest positioning: an inspection/assistive tool, not an overlay or compliance product.
