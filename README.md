# KeyWise Web

A WCAG 2.2 keyboard accessibility companion browser extension for Chrome, Edge, and Firefox.

KeyWise Web helps users and developers **inspect** keyboard accessibility, focus visibility, tab
order, navigation structure, and accessible names on web pages. It is an **inspection and assistive
browsing tool** — not an overlay, not an automatic website fixer, and not a compliance certifier.

## Why this exists

Keyboard accessibility is one of the most common — and most fixable — barriers on the web. Yet most
developers and many users have no quick way to _see_ how a page behaves for keyboard-only navigation:
where focus goes, whether it is visible, whether controls have names, and whether the page can be
navigated at all without a mouse. KeyWise Web aims to make that experience visible and inspectable,
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

## v0 scope (Phase 0A)

This is the **repository skeleton only**. No product features are implemented yet.

### What v0 does

- Establishes a pnpm + TypeScript monorepo with a WXT + React + Manifest V3 extension.
- Provides typed package boundaries for types, rule metadata, scanning, the keyboard engine, the
  focus overlay, and report generation — all as documented placeholders.
- Ships popup, options, background, and content-script entrypoints that build and load.
- Includes static demo pages, documentation, tests, and CI.

### What v0 does NOT do

- No real accessibility analysis (scanning returns a placeholder result).
- No automatic fixes or DOM rewriting.
- No AI. No speech. No overlays.
- No legal compliance claims of any kind.
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

KeyWise Web helps inspect keyboard accessibility at runtime. **It does not certify legal compliance**
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
