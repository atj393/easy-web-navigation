# Microsoft Edge Add-ons — listing (copy-paste ready)

Paste these into Microsoft Partner Center. Nothing here is submitted
automatically. The package is the same Chromium MV3 build as Chrome.

## Extension name

Easy Web Navigation - Keyboard Access Check

## Short description

Check keyboard focus, keyboard paths, and navigation on web pages.

## Detailed description

Easy Web Navigation is a read-only keyboard accessibility companion for Microsoft Edge. It helps
users and developers inspect how a page behaves for keyboard-only navigation — where focus goes,
whether it's visible, the tab order, navigation structure, and whether controls have accessible
names.

It is an inspection and assistive browsing tool. It does not modify the websites you visit, and it is
not an accessibility overlay or an automatic fixer.

Features:

• Read-only scan of the current page for deterministic WCAG 2.2 keyboard-profile checks
(clickable-not-focusable, unlabeled controls, unlabeled form inputs, positive tabindex, missing
main landmark, missing skip link).
• Visual focus helper that tracks the keyboard-focused element.
• Tab-path visualization with numbered markers.
• Locate any finding on the page.
• Copy or download a developer-friendly Markdown report.
• Optional, user-controlled monitoring that re-applies your chosen helpers across supported pages.

Privacy:

• All analysis is local. No page content is uploaded; no analytics; no AI; no remote API calls; no
account. Settings are stored locally; reports are generated locally.

## Product features (bullet list)

- Read-only keyboard accessibility scan
- Visual focus helper
- Tab-path visualization
- Per-issue "Show this problem"
- Markdown report (copy / download)
- User-controlled monitoring mode (current tab / this site / all supported websites)

## Privacy statement

No personal data is collected, transmitted, sold, or used for analytics. The active page DOM is
processed locally to produce accessibility findings. Settings are stored locally; reports are
generated locally and only copied/downloaded by user action. See `privacy-policy.md`.

## Permission justifications

- **activeTab** — inspect the active tab only after the user acts.
- **scripting** — inject the read-only content script into the active tab on demand.
- **storage** — persist user preferences locally.
- **optional host permissions (http/https)** — requested only for "This site" / "All supported
  websites" monitoring.

## Certification / reviewer testing notes

To verify behavior:

1. Load the extension and open any normal http/https web page (or a bundled demo page).
2. Click the toolbar icon, then **Check this page** — issues appear with severity + WCAG refs.
3. Toggle **Show keyboard focus**; press Tab — a rectangle tracks the focused element.
4. Toggle **Show keyboard path** — numbered markers appear in tab order.
5. Click **Show this problem** on an issue — the element is briefly highlighted.
6. **Copy / Download** the Markdown report.
7. **Start automatic checking** (This page only needs no extra permission). "This website" / "All
   websites" request an optional host permission first — only after the user chooses them.
8. **Stop automatic checking** — overlays are removed.
9. On a browser-internal page (e.g. `edge://settings`) the extension shows a friendly "can't act on
   this page" message rather than failing.

Reviewer notes:

- The extension does not modify page source. The only DOM it inserts is an extension-owned overlay
  container used for visual highlighting; it is removed when not in use.
- All analysis happens locally. No remote API calls, no analytics, no AI.
- Optional host permissions are requested only after the user chooses broader monitoring.

## Search terms

accessibility, keyboard navigation, WCAG, focus order, tab order, a11y, developer tools

## Markets

All markets (no region-specific content).

## Asset notes

- Logo: `assets/edge-logo-300x300.png` (brand artwork).
- Screenshots: capture real 1280×800 images per `screenshot-plan.md` before submission; the SVG in
  `assets/` is a labeled placeholder, not a real screenshot.
