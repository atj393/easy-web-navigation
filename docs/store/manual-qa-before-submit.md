# Manual QA before submission (REQUIRED)

Automated tooling cannot drive a real browser here, so this manual pass is **required** before
submitting to any store. Run it in Chrome and again in Edge.

Build: `pnpm release:all` → load the unzipped `artifacts/chrome/...` (Chrome) or
`artifacts/edge/...` (Edge) as an unpacked extension. Serve demos:
`pnpm -C apps/demo-sites preview` (http://localhost:4321).

For each item, mark Pass/Fail.

## Manual scan

- [ ] Open `fake-buttons-page`, click **Check this page** → issues appear with severities + WCAG refs.
- [ ] `semantic-good-page` → few/no issues; honest "not a guarantee" wording shown.

## Keyboard focus highlight

- [ ] **Show keyboard focus** on `broken-keyboard-page`; press Tab/Shift+Tab → rectangle tracks focus.
- [ ] **Hide keyboard focus** → rectangle removed.

## Keyboard path

- [ ] **Show keyboard path** → numbered markers in tab order (positive `tabindex` first).
- [ ] **Hide keyboard path** → markers removed.

## Show this problem

- [ ] **Show this problem** on an issue → element briefly highlighted; "no longer on the page" message
      if it was removed.

## Results

- [ ] **Copy results** → paste shows clean report + disclaimer.
- [ ] **Download results** → file downloads and opens correctly.

## Automatic checking

- [ ] **This page only** → Start; page is checked and enabled guides apply. No extra permission prompt.
- [ ] Navigate / trigger an in-page (single-page-app) navigation → guides re-apply (throttled).
- [ ] **This website** → Start triggers an optional host-permission prompt; granting enables cross-page
      auto re-apply; denying falls back to this-page-only with a friendly message.
- [ ] **Stop automatic checking** → overlays removed; preferences remembered on next Start.

## Restricted pages

- [ ] `chrome://settings` / `edge://settings` → friendly "can't act on this page" message; no crash.

## Hygiene

- [ ] No console errors in the popup during the flows above.
- [ ] Toolbar icon renders at all sizes.
- [ ] No compliance overclaiming anywhere in the UI.

## Result

- [ ] Chrome QA passed (date / version): \***\*\_\_\*\***
- [ ] Edge QA passed (date / version): \***\*\_\_\*\***

Do not submit until the relevant browser's QA passes.
