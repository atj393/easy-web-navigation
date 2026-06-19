# Manual QA before submission (REQUIRED)

Automated tooling cannot drive a real browser here, so this manual pass is **required** before
submitting to any store. Run it in Chrome and again in Edge.

Build: `pnpm release:all` → load the unzipped `artifacts/chrome/...` (Chrome) or
`artifacts/edge/...` (Edge) as an unpacked extension. Serve demos:
`pnpm -C apps/demo-sites preview` (http://localhost:4321).

For each item, mark Pass/Fail.

## Manual scan

- [ ] Open `fake-buttons-page`, click **Scan current page** → issues appear with severities + WCAG refs.
- [ ] `semantic-good-page` → few/no issues; honest "not a guarantee" wording shown.

## Focus helper

- [ ] **Show focus helper** on `broken-keyboard-page`; press Tab/Shift+Tab → rectangle tracks focus.
- [ ] **Hide focus helper** → rectangle removed.

## Tab path

- [ ] **Show tab path** → numbered markers in tab order (positive `tabindex` first).
- [ ] **Hide tab path** → markers removed.

## Locate

- [ ] **Locate on page** on an issue → element briefly highlighted; "no longer on the page" message
      if it was removed.

## Report

- [ ] **Copy Markdown report** → paste shows clean report + disclaimer.
- [ ] **Download Markdown report** → file downloads and opens correctly.

## Monitoring

- [ ] **Current tab session** → Start; page scans and enabled helpers apply. No extra permission prompt.
- [ ] Navigate / trigger an SPA route change → helpers re-apply (throttled).
- [ ] **This site** → Start triggers an optional host-permission prompt; granting enables cross-page
      auto re-apply; denying falls back to current tab with a friendly message.
- [ ] **Stop monitoring** → overlays removed; preferences remembered on next Start.

## Restricted pages

- [ ] `chrome://settings` / `edge://settings` → friendly "can't act on this page" message; no crash.

## Hygiene

- [ ] No console errors in the popup during the flows above.
- [ ] Toolbar icon renders at all sizes.
- [ ] No compliance overclaiming anywhere in the UI.

## Result

- [ ] Chrome QA passed (date / version): ****\_\_****
- [ ] Edge QA passed (date / version): ****\_\_****

Do not submit until the relevant browser's QA passes.
