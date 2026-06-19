# Release checklist (before store submission)

Work top to bottom. Nothing here is automated — submission stays with the maintainer.

## Build & validate

- [ ] `pnpm install` clean.
- [ ] `pnpm run ci` passes (typecheck, lint, test, build).
- [ ] `pnpm build:firefox` passes (optional Firefox target).
- [ ] `pnpm release:all` produces `artifacts/chrome/...` and `artifacts/edge/...` ZIPs.
- [ ] `pnpm release:inspect` confirms `manifest.json` is at each ZIP root.
- [ ] Manifest version is correct (currently **0.1.0**) and matches both packages.
- [ ] Manifest permissions are exactly `activeTab`, `scripting`, `storage`; optional host
      permissions are `http://*/*`, `https://*/*`; no required broad host permissions.

## Manual QA

- [ ] Complete `manual-qa-before-submit.md` in Chrome.
- [ ] Complete `manual-qa-before-submit.md` in Edge.
- [ ] No console errors in the popup during normal use.

## Assets

- [ ] 128×128 icon present (`apps/extension/public/icon-128.png`).
- [ ] Chrome small promo `assets/chrome-small-promo-440x280.png` reviewed.
- [ ] Edge logo `assets/edge-logo-300x300.png` reviewed.
- [ ] **Real** screenshots captured per `screenshot-plan.md` (placeholder removed).

## Accounts & policy

- [ ] Chrome Web Store developer account ready.
- [ ] Microsoft Partner Center (Edge) developer account ready.
- [ ] Privacy policy reviewed (`privacy-policy.md`).
- [ ] Privacy policy hosted at a public URL (if the store requires one).

## Chrome submission

- [ ] Upload `artifacts/chrome/easy-web-navigation-chrome-v0.1.0.zip`.
- [ ] Paste listing text from `chrome-web-store-listing.md`.
- [ ] Set category (Accessibility), language (English), search terms.
- [ ] Complete the Privacy practices tab using `privacy-disclosure.md` (remote code = No;
      data collection = none).
- [ ] Paste reviewer notes from `reviewer-test-instructions.md`.
- [ ] Upload icon, promo, and real screenshots.

## Edge submission

- [ ] Upload `artifacts/edge/easy-web-navigation-edge-v0.1.0.zip`.
- [ ] Paste listing text from `edge-add-ons-listing.md`.
- [ ] Complete privacy/data fields using `privacy-disclosure.md`.
- [ ] Paste certification/testing notes from `edge-add-ons-listing.md`.
- [ ] Upload logo and real screenshots; select All markets (or your choice).

## Final

- [ ] Submit Chrome only after Chrome QA passes.
- [ ] Submit Edge only after Edge QA passes.
- [ ] Tag the release in git after submission (e.g. `v0.1.0`).
