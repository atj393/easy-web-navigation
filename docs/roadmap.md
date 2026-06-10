# Roadmap

The roadmap is deliberately incremental. Each milestone is independently demonstrable and avoids
overclaiming. Scope may shift, but the honesty constraints (no compliance claims, no overlays, no
aggressive auto-fix) do not.

## v0.1 — Repository skeleton (current)

- Monorepo, extension entrypoints, package boundaries, docs, tests, and CI.
- No real analysis. Everything is a documented placeholder.

## v0.2 — Scanner

- Implement read-only DOM inspection in `@keywise/dom-scanner`.
- Light up the first WCAG keyboard-profile rules (e.g. fake buttons, unlabeled inputs,
  positive `tabindex`, missing main landmark / skip link).
- Real `ScanResult` data flowing into the popup summary and issue list.

## v0.3 — Focus helper

- Implement the optional, passive visual focus helper in `@keywise/focus-overlay`.
- User-initiated and reversible; restrained styling that does not fight the page.

## v0.4 — Tab-path visualization

- Implement focus tracking and tab-path recording in `@keywise/keyboard-engine`.
- Visualize the keyboard tab order over the page to make focus-order issues obvious.

## v0.5 — Developer report export

- Flesh out `@keywise/report-generator` output (Markdown + JSON) for sharing findings.
- Useful, copy-pasteable reports for developers and QA, with the standing disclaimer.

## v1.0 — Portfolio release

- Polished popup/options UX, documented demo flow, and store-ready packaging for Chromium and
  Firefox.
- Clear, honest positioning as an inspection/assistive tool.
