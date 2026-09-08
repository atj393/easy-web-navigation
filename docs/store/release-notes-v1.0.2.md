# Release notes — Easy Web Navigation - Keyboard Access Check v1.0.2

A correctness and stability release for **Easy Web Navigation - Keyboard Access Check** ("Easy Web
Navigation"), a privacy-first, read-only keyboard accessibility companion for Chrome, Edge, and
Firefox.

> v1.0.1 is the version currently live on the Chrome Web Store. These notes accompany the v1.0.2
> build prepared for manual submission. Submission is manual and stays with the maintainer.

## What changed in v1.0.2

### The popup no longer resizes while it opens

Opening the extension grew and reflowed the popup for roughly three quarters of a second before it
settled. An extension popup is auto-sized by the browser, and the popup's width was derived from
`100vw` — which _is_ the popup's own width. Content size and window size each depended on the other,
and the browser walked that loop 8px at a time until it hit a clamp. Measured in Chromium: 31 resize
rounds from a cold start.

The popup now follows an explicit sizing contract — no viewport units, a fixed pixel width and height
carried by the document itself so the size is final on the first painted frame, and variable content
scrolling inside the shell. It settles once, at one size, from every starting point.

### Findings are more nearly correct, in both directions

Patterns that were reported as problems but are not:

- disabled and `aria-disabled` controls, and anything inside an `inert` region — that is, the whole
  page behind an open dialog;
- every inactive tab, menu item, radio and tree item in a roving-tabindex widget, which is the
  pattern the ARIA Authoring Practices prescribe;
- icon buttons whose label sits on the icon (`<button><svg aria-label="Close">`);
- an unparseable `tabindex` on an otherwise focusable control, and hidden markup carrying a positive
  `tabindex`.

Real problems that were being missed — a clean result a user would have believed:

- an unlabeled `<select>` was treated as labelled by its own option text, and a `<textarea>` by its
  contents. Those are the control's value, not its name;
- a decorative `aria-hidden` glyph counted as an accessible name;
- a control inside a component whose host is hidden was treated as visible.

A page built entirely from correct widgets reported 10 findings before and reports 0 now.

### The options page keeps its promises

Every setting on the options page previously did nothing. The **Disabled sites** list told users the
extension would stay inactive on those sites and was never consulted, so excluded sites were still
checked. It is now enforced everywhere — the popup will not check them, and nothing is injected or
drawn there. **Show WCAG references** now drives the popup and saved results. Settings that only
duplicated the popup's own controls were removed rather than left implying behaviour that did not
exist.

### Automatic checking works on Firefox

Manifest V2 spells optional host access `optional_permissions` rather than
`optional_host_permissions`, so the Firefox build declared no optional origins and the "This website"
and "All websites" scopes could never be granted there. Fixed. **Required permissions are unchanged.**

### Faster on large pages

Drawing keyboard-path markers forced a layout calculation per marker, and a scan re-resolved styles
for every ancestor of every candidate. On a page with 1801 focusable elements, the keyboard path with
500 markers went from 582ms to 124ms.

### Clearer results

Findings are ordered most serious first and each carries a plain-language explanation of its severity.
Before a check the summary reads "Not checked yet" rather than a dash. Restricted pages are explained
calmly instead of surfacing a browser error. Report actions and the primary action stay visible while
you scroll. Dark mode and Windows high contrast are supported.

## Privacy & security

Unchanged from v1.0.1. All analysis is local. No page content is uploaded; no analytics; no tracking;
no AI; no remote API calls; no account; no remote code.

Two improvements _to_ privacy: the per-site opt-out now actually works, and the note about what a
saved report contains now appears at the moment results leave the popup rather than as a footnote.

## Permissions

Identical to v1.0.1 on Chrome and Edge:

- Required: `activeTab`, `scripting`, `storage`.
- Required host permissions: **none**.
- Optional host permissions: `http://*/*`, `https://*/*` — requested only on your action, only for
  this-website / all-websites automatic checking.

The only difference anywhere is that the Firefox build now declares those same optional origins under
the key Manifest V2 uses. `scripts/check-manifest.mjs` asserts this on every CI run.

## Honest limitations

Unchanged. A clean report is **not** a compliance pass; Easy Web Navigation does not certify legal
compliance with WCAG, BITV, EN 301 549, the EAA, the ADA, or Section 508. Full accessibility requires
source-level remediation, manual testing, and testing with real assistive technologies.
Browser-internal and privileged pages cannot be inspected. SPA refresh is URL-signal-based and
best-effort; `missing-visible-focus` is not yet scored. See [limitations.md](../limitations.md),
which now also documents what these checks get wrong on purpose.

## Before submitting

- Store **screenshots show the v1.0.1 popup layout** and should be reshot — the popup was
  restructured. No other listing text needs changing: the description, privacy disclosure and
  permission justifications are all still accurate, because none of that changed.
- Firefox and Edge runtime behaviour is unverified by the maintainer; both targets build and both
  manifests are asserted.

## Packages

- Chrome Web Store: `artifacts/chrome/easy-web-navigation-chrome-v1.0.2.zip`
- Microsoft Edge Add-ons: `artifacts/edge/easy-web-navigation-edge-v1.0.2.zip` (same Chromium MV3 build)

Generate with `pnpm release:all`. Submission is manual — see [release-checklist.md](release-checklist.md).
