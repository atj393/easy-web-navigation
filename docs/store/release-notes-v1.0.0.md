# Release notes — v1.0.0 (first public production release)

First public production release of **Easy Web Navigation**, a privacy-first, read-only keyboard
accessibility companion for Chrome, Edge, and Firefox.

> Not yet live in any store. These notes accompany the production build prepared for manual
> submission to the Chrome Web Store and Microsoft Edge Add-ons. Store links will be added after each
> listing is approved.

## What it does

- **Check this page** — a read-only scan of the active page for deterministic keyboard-profile
  checks: `clickable-not-focusable`, `unlabeled-control`, `unlabeled-form-input`, `positive-tabindex`,
  `missing-main-landmark`, `missing-skip-link`.
- **Keyboard focus highlight** — a visual rectangle that tracks the keyboard-focused element.
- **Keyboard path** — numbered markers in the computed keyboard order through **visible** controls,
  with a chooseable limit of 100 (recommended), 250, or 500 markers. Collapsed, off-canvas, clipped,
  inert, and hidden controls are excluded so markers reflect what a user can actually see.
- **Show this problem** — highlight the element behind any finding.
- **Results** — copy or download a clean Markdown report (stable JSON shape available).
- **Automatic checking** — explicit, user-started; re-applies your chosen guides and checks supported
  pages within a scope you control (this page only / this website / all websites), including SPA route
  changes. Optional host permissions are requested only for the broader scopes, only on your action.

## What changed since v0.1.0

- Prepared the first public **production** release (v1.0.0) for the Chrome Web Store and Microsoft
  Edge Add-ons.
- Replaced the generated placeholder icon with the **official Easy Web Navigation icon**; all runtime
  and store/GitHub artwork is now downscaled from that single canonical source.
- Rewrote the README as an end-user product home, refreshed store copy and release documentation, and
  added a repository guide (`CLAUDE.md`) and clearer support guidance (`SUPPORT.md`).

## Privacy & security

- All analysis is local. No page content is uploaded; no analytics; no tracking; no AI; no remote API
  calls; no account; no remote code.
- Minimal permissions: `activeTab`, `scripting`, `storage`. Optional host permissions
  (`http://*/*`, `https://*/*`) are requested only when you opt into this-website / all-websites
  automatic checking.
- No permissions, tracking, page mutation, automatic fixes, or compliance claims were added in this
  release.

## Honest limitations

- A clean report is **not** a compliance pass. Easy Web Navigation does not certify legal compliance
  with WCAG, BITV, EN 301 549, the EAA, the ADA, or Section 508.
- Full accessibility requires source-level remediation, manual testing, and testing with real
  assistive technologies.
- Browser-internal / privileged pages cannot be inspected.
- SPA refresh is URL-signal-based and best-effort; `missing-visible-focus` is not yet scored.

## Packages

- Chrome Web Store: `artifacts/chrome/easy-web-navigation-chrome-v1.0.0.zip`
- Microsoft Edge Add-ons: `artifacts/edge/easy-web-navigation-edge-v1.0.0.zip` (same Chromium MV3 build)

Generate with `pnpm release:all`. Submission is manual — see `release-checklist.md`. Real product
screenshots must be captured per `screenshot-plan.md` before submission.
