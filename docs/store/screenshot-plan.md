# Screenshot plan

Capture these **real** screenshots from a live browser session before submitting to any store.
Recommended size **1280×800** (Chrome's preferred screenshot size; Edge also accepts 640×480).
Do not submit the placeholder in `assets/`.

Setup: `pnpm dev` (or load the production build), then `pnpm -C apps/demo-sites preview` and open the
demo pages from `http://localhost:4321`.

| #   | File                       | Page                   | Action                                            | What should be visible                                        |
| --- | -------------------------- | ---------------------- | ------------------------------------------------- | ------------------------------------------------------------- |
| 1   | `01-popup-before-scan.png` | `semantic-good-page`   | Open the popup (no check yet)                     | Header, Check button, empty-state hint, severity legend       |
| 2   | `02-scan-results.png`      | `fake-buttons-page`    | Click **Check this page**                         | Summary cards + issue list with severity badges and WCAG refs |
| 3   | `03-locate-issue.png`      | `fake-buttons-page`    | Click **Show this problem** on an issue           | The highlighted element on the page + the popup issue         |
| 4   | `04-focus-helper.png`      | `broken-keyboard-page` | Toggle **Show keyboard focus**, press Tab         | Blue focus rectangle around the focused element               |
| 5   | `05-tab-path.png`          | `broken-keyboard-page` | Toggle **Show keyboard path**                     | Numbered markers along the keyboard tab order                 |
| 6   | `06-report-export.png`     | `form-labels-page`     | Click **Copy/Download report**, show the Markdown | The report text with the disclaimer                           |
| 7   | `07-monitoring-mode.png`   | any demo page          | Start automatic checking (This page only)         | "Automatic checking: …" status + the refresh note             |

Tips:

- Use a clean browser profile and a comfortable zoom so text is legible.
- Crop to the popup + relevant page area; avoid showing unrelated browser chrome or personal data.
- Keep the captures honest — show only real behavior.
- Save the exported PNGs into `docs/store/assets/` and remove the SVG placeholder before submission.
