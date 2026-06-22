# Release notes — v0.1.0 (release candidate)

First public release candidate of **Easy Web Navigation**, a read-only keyboard accessibility
companion for Chrome, Edge, and Firefox.

## Highlights

- **Read-only scan** of the current page for deterministic WCAG 2.2 keyboard-profile checks:
  `clickable-not-focusable`, `unlabeled-control`, `unlabeled-form-input`, `positive-tabindex`,
  `missing-main-landmark`, `missing-skip-link`.
- **Keyboard focus highlight** — a visual rectangle that tracks the keyboard-focused element.
- **Keyboard path** — numbered markers in the computed keyboard tab order.
- **Show this problem** — highlight the element behind any finding.
- **Developer report** — copy or download a clean Markdown report (stable JSON shape available).
- **Automatic checking** — explicit, user-started; re-applies your chosen guides and scans supported
  pages within a scope you control (this page only / this website / all websites), including SPA
  route changes. Optional host permissions are requested only for the broader scopes.

## Privacy & security

- All analysis is local. No page content is uploaded; no analytics; no AI; no remote API calls; no
  account; no remote code.
- Minimal permissions: `activeTab`, `scripting`, `storage`. Optional host permissions
  (`http://*/*`, `https://*/*`) are requested only when you opt into site / all-sites monitoring.

## Honest limitations

- A clean report is **not** a compliance pass. Easy Web Navigation does not certify legal compliance
  with WCAG, BITV, EN 301 549, the EAA, the ADA, or Section 508.
- Full accessibility requires source-level remediation, manual testing, and testing with real
  assistive technologies.
- Browser-internal/privileged pages cannot be scanned.
- SPA refresh is URL-signal-based and best-effort; `missing-visible-focus` is not yet scored.

## Packages

- Chrome Web Store: `artifacts/chrome/easy-web-navigation-chrome-v0.1.0.zip`
- Microsoft Edge Add-ons: `artifacts/edge/easy-web-navigation-edge-v0.1.0.zip` (same Chromium MV3 build)

Generate with `pnpm release:all`. Submission is manual — see `release-checklist.md`.
