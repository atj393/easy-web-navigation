# CLAUDE.md

Repository guide for Claude Code sessions working on this project.

## Product

**Easy Web Navigation** — a privacy-first, **read-only** keyboard accessibility companion browser
extension for Chrome, Edge, and Firefox. It helps people understand how a website works with a
keyboard: check a page for possible keyboard-access problems, see where keyboard focus moves, see the
keyboard path through visible controls, and copy/download results. It is an inspection and assistive
browsing tool — not an overlay, not an auto-fixer, not a compliance certifier.

- **Store / manifest name:** `Easy Web Navigation - Keyboard Access Check` (manifest `short_name`:
  `Easy Web Nav`). The compact toolbar/popup brand stays **Easy Web Navigation** (`PRODUCT_NAME` in
  code). Use the short brand in prose; do not rename packages, the repo slug, or ZIP base names.
- **Current production version:** 1.0.1
- **Repository:** https://github.com/atj393/easy-web-navigation
- **Default branch:** main
- Read [HANDOVER.txt](HANDOVER.txt) at the start of every session for current state.

## Repository layout

```
apps/
  extension/        WXT + React + Manifest V3 extension (popup, options, background, content)
                    public/         runtime PNG icons (generated; do not hand-edit)
                    scripts/        generate-icons.mjs (downscales the brand source)
  demo-sites/       Static HTML pages for manual keyboard testing
packages/
  shared-types/     Framework-agnostic types + typed message envelope
  wcag-rules/       WCAG criteria + rule metadata + deterministic evaluators
  dom-scanner/      Read-only DOM inspection -> ScanResult (+ keyboard-path visibility filter)
  keyboard-engine/  Read-only tab-order computation
  focus-overlay/    Extension-owned isolated overlay (focus helper, locate, path markers)
  report-generator/ Markdown + JSON report output
assets/brand/       Canonical brand icon source (see Icon, below)
scripts/            create-store-zips.mjs, generate-store-assets.mjs, lib/png.mjs
docs/               architecture, limitations, demo-plan, roadmap, store/ (listings + checklists)
```

## Non-negotiable product rules

These constraints define the product. Do not violate them without explicit user approval:

- **Read-only.** Never mutate inspected page nodes. The only DOM the extension creates is its own
  isolated, extension-owned overlay container, removed when unused.
- **No tab-order change** on inspected pages.
- **No ARIA injection** into inspected pages.
- **No auto-fix** of websites.
- **No AI, no speech, no analytics, no tracking, no remote API calls, no remote code, no user
  accounts, no payment/subscriptions/monetisation.**
- **No new required or optional permissions** without explicit user approval.
- **No changes to scanner rules, monitoring behavior, or keyboard-path behavior** unless explicitly
  requested.
- **No legal/standards compliance claims** (WCAG/BITV/EN 301 549/EAA/ADA/Section 508). A clean
  report is never a compliance pass.

### Permissions (must stay exactly this)

- Required permissions: `activeTab`, `scripting`, `storage`.
- Optional host permissions: `http://*/*`, `https://*/*` (requested only on user action for
  site/all-sites automatic checking).
- Required host permissions: **none**. (`wxt.config.ts` strips the host permission WXT would add for
  the runtime content script.)

## Brand icon

- Canonical source (user-provided original artwork):
  `assets/brand/easy-web-navigation-icon-source.png`. This is the only authoritative icon. Do not
  replace it with generated or downloaded artwork; do not edit the original in the user's Downloads.
- Runtime icons (`apps/extension/public/icon-{16,32,48,128}.png`) and store/GitHub assets are
  **downscaled from that source** by pure-Node scripts (no external dependencies):
  `apps/extension/scripts/generate-icons.mjs` and `scripts/generate-store-assets.mjs`
  (shared codec in `scripts/lib/png.mjs`). Regenerate from the source — never reintroduce older
  synthesized artwork.

## Common commands

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build            # Chromium MV3
pnpm build:firefox
pnpm run ci           # typecheck -> lint -> test -> build   (note: `run`, not `pnpm ci`)
pnpm release:all      # build + write store ZIPs to artifacts/
pnpm release:inspect  # validate existing ZIPs (manifest at root)
```

## Store packages

- Chrome: `artifacts/chrome/easy-web-navigation-chrome-v<version>.zip`
- Edge: `artifacts/edge/easy-web-navigation-edge-v<version>.zip` (same Chromium MV3 build)
- `artifacts/` is git-ignored. ZIP filenames follow `apps/extension/package.json` `version`.
- **Manual store submission is user-owned.** Do not upload to any store, and do not create a git tag
  or GitHub Release unless explicitly asked.

## Git / commit rules

```bash
git config user.name "atj393"
git config user.email "alexistoby393@gmail.com"
```

- Commits are authored by `atj393 <alexistoby393@gmail.com>` only.
- **No `Co-Authored-By`. No Claude / AI / assistant / bot / generated-by attribution** anywhere.
- Do not amend or force-push. Push to `origin main` only when the remote is
  `https://github.com/atj393/easy-web-navigation.git`.
- Update [HANDOVER.txt](HANDOVER.txt) at the end of every working iteration (phase, branch, latest
  commit, files changed, test results, manual tasks remaining).
