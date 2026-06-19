# Documentation assets

This folder holds images used by the README and docs (screenshots, a short demo GIF, diagrams).

## Planned assets (to be added)

- `popup.png` — the extension popup after a scan (summary cards + issue list).
- `focus-helper.png` — the focus rectangle tracking a focused element.
- `tab-path.png` — numbered tab-path markers on a demo page.
- `report.png` — an exported Markdown report opened in an editor.
- `demo.gif` — a ~10s capture of the 60-second demo flow (see `../demo-plan.md`).

## Guidelines

- Capture on the bundled demo pages (`apps/demo-sites`) so screenshots contain no private data.
- Keep files reasonably small (prefer optimized PNG; keep the GIF short).
- Do **not** commit fake or misleading screenshots, and do not imply compliance certification.
- The extension toolbar icon is generated from `apps/extension/icon-source.svg`
  (see `apps/extension/scripts/generate-icons.mjs`).

> No images are committed yet. The README references this folder; add real captures here after a
> manual browser session.
