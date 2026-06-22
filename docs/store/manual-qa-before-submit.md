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
- [ ] Summary uses "keyboard items" and the real total (e.g. "Showing all N keyboard items." or
      "Showing the first 100 of N keyboard items." with "Choose a higher limit to show more.").
- [ ] **Number of keyboard path markers** offers 100 (recommended) / 250 / 500. Changing it while the
      path is visible redraws immediately (no toggle off/on). On a >100-item page, 100 shows "first
      100 of N" and 500 shows "all N".
- [ ] The chosen limit is remembered after closing/reopening the popup and across Stop/Start of
      automatic checking.
- [ ] **Hide keyboard path** → markers removed.

## Keyboard path — collapsed/hidden controls (visibility fix)

- [ ] Open ChatGPT and **close its sidebar**. Open Easy Web Navigation → **Show keyboard path**.
      Expected: **no** numbered markers appear for the closed sidebar's controls.
- [ ] **Open the sidebar**, then refresh/re-enable keyboard path → its visible controls can now appear.
- [ ] On a normal long page, scroll down → regular controls below the initial viewport are still
      included in the keyboard path (vertical off-screen is not a reason to hide a control).
- [ ] Controls above the viewport remain included; a control styled `opacity: 0` is not excluded just
      for opacity.
- [ ] Repeat with 100 / 250 / 500 marker limits → no console errors; no page elements are modified.

## Show this problem

- [ ] **Show this problem** on an issue → element briefly highlighted; "no longer on the page" message
      if it was removed.

## Results

- [ ] **Copy results** → paste shows clean report + disclaimer.
- [ ] **Download results** → file downloads and opens correctly.

## Automatic checking

- [ ] **This page only** → Start; page is checked and enabled guides apply. No extra permission prompt.
- [ ] **This page only** shows the limitation note (checks the page you started on; you may need to
      open the extension again after navigating) both before and after Start — never hidden in a
      tooltip. The status reads "Automatic checking: On for this page" with the note directly under it.
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
