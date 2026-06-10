# Roadmap

The roadmap is deliberately incremental. Each milestone is independently demonstrable and avoids
overclaiming. Scope may shift, but the honesty constraints (no compliance claims, no overlays, no
aggressive auto-fix) do not.

## v0.1 — Repository skeleton (current)

- Monorepo, extension entrypoints, package boundaries, docs, tests, and CI.
- No real analysis. Everything is a documented placeholder.

## v0.2 — Scanner (Phase 0B — done)

- Implemented read-only DOM inspection in `@easy-web-navigation/dom-scanner`.
- Lit up the first six WCAG keyboard-profile rules: `clickable-not-focusable`,
  `unlabeled-control`, `unlabeled-form-input`, `positive-tabindex`, `missing-main-landmark`,
  `missing-skip-link`. `missing-visible-focus` remains deferred.
- Real `ScanResult` data flows into the popup summary cards, issue list, and Markdown export.
- Still read-only: no DOM mutation, no auto-fix, no broad host permissions.

## v0.3 — Focus helper (Phase 0C — done)

- Implemented the optional, read-only visual focus helper in `@easy-web-navigation/focus-overlay`.
- User-initiated and reversible; an extension-owned, shadow-isolated, non-interactive overlay that
  rectangles the focused element and can temporarily "locate" a scanned issue's element.
- Never mutates inspected nodes; cleans up fully when toggled off.
- Still deferred: scoring native focus _visibility_ (`missing-visible-focus`).

## v0.4 — Tab-path visualization (Phase 0D — done)

- Implemented tab-order computation in `@easy-web-navigation/keyboard-engine` (reusing dom-scanner's focusable
  detection): positive `tabindex` first, then DOM order; negatives/hidden/disabled excluded.
- Numbered tab markers drawn in the read-only overlay, toggled from the popup, with a summary and a
  default 100-item cap for large pages.
- Still read-only: no tab-order changes, no focus stealing, no ARIA injection.

## v0.5 — Developer report export (Phase 0E — done)

- Clean, sectioned Markdown report and a stable JSON report from
  `@easy-web-navigation/report-generator`, with a prominent non-compliance disclaimer.
- Popup **Copy Markdown report** (clipboard API + textarea fallback) and **Download Markdown
  report**; optional tab-path summary clearly labeled as a runtime visual aid.

## v1.0 — Portfolio release (in progress)

- **Phase 0P (done):** public open-source standardization (community files, templates, security and
  support policies) and publishing to `atj393/easy-web-navigation`.
- **Phase 0F (done):** presentation polish — original extension icons wired into the manifest,
  polished popup (severity legend, empty/error states) and options page, and a concrete 60-second
  demo script.
- **Remaining:** screenshots/GIFs, manual cross-browser testing, and store-ready packaging for
  Chromium and Firefox.
- Clear, honest positioning as an inspection/assistive tool throughout.
