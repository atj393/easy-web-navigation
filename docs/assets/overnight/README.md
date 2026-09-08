# Overnight hardening — visual evidence

Captured from the packaged Chromium build with `scripts/`-adjacent harness code,
at the size the browser actually settles the popup to, with a stubbed active tab
so the full interactive UI renders.

| File                     | What it shows                                                                                                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `popup-before.png`       | The popup before the change, at its settled 460x600. The result count is at the top but the findings themselves are roughly 700px further down, below the visual-guide and automatic-checking sections. |
| `popup-after.png`        | The same state after: a fixed 420x580 shell, findings directly under the primary action, and the report actions pinned in the footer.                                                                   |
| `popup-after-guides.png` | The Guides panel — the visual helpers, moved out of the primary path.                                                                                                                                   |
| `popup-after-dark.png`   | The dark palette. Every colour token has a dark counterpart, asserted by a test.                                                                                                                        |

These are stills. The behaviour that RB-001 was actually about — the popup
growing while it opens — is a motion problem, and the measurement of it lives in
`docs/OVERNIGHT_RESULT.md` and in `scripts/check-popup-stability.mjs`, which
fails on the pre-fix build and passes on this one.
