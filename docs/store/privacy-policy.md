# Privacy Policy — Easy Web Navigation

_Last updated: 2026-06-18_

Easy Web Navigation is a browser extension that helps users and developers inspect keyboard
accessibility on web pages. This policy explains what the extension does with data. In short: it
processes pages **locally** and **collects nothing**.

## What the extension does

Easy Web Navigation performs read-only inspection of the page in your active tab to report keyboard
accessibility findings (focus, tab order, navigation structure, accessible names). It can draw
visual helpers (a focus rectangle, numbered tab-path markers, an issue highlight) in an
extension-owned overlay and can generate a Markdown/JSON report that you copy or download.

## Data processed locally

- The **DOM of the page you choose to scan** is read in your browser to compute findings. This
  happens only when you act (click "Scan current page", toggle a helper, or run monitoring).
- Processing is entirely **on-device**. The page content is **not** sent anywhere.

## Data stored locally

- Your **preferences** (focus-helper and tab-path choices, monitoring scope, monitoring on/off) are
  stored using the browser's local extension storage on your device.
- That is the only data stored. No page content or scan history is persisted.

## What is NOT collected or transmitted

- No personal or sensitive information is collected.
- No analytics, telemetry, or usage tracking.
- No remote API calls; no AI calls; no external servers.
- No account, login, or identifier.
- No page content is uploaded or shared.
- No data is sold or transferred to third parties.

## Permissions and why

- **activeTab** — lets the extension inspect the current tab, only when you invoke it.
- **scripting** — injects the read-only inspection script into the active tab on demand.
- **storage** — saves your preferences locally.
- **Optional host permissions (`http://*/*`, `https://*/*`)** — requested only if you choose the
  "This site" or "All supported websites" monitoring scope, so helpers can re-apply as you browse.
  Manual scanning never requests them. You can revoke them anytime in your browser's extension
  settings.

## Clipboard behavior

The extension only writes to the clipboard when you click "Copy Markdown report". It never reads the
clipboard.

## Monitoring behavior

Monitoring is off by default and runs only after you explicitly start it. It re-applies the visual
helpers you enabled and scans supported pages within the scope you chose. It remains read-only and
uploads nothing. Stopping monitoring removes the overlays.

## Reports

Reports are generated locally from the current scan. They are only saved or shared when you copy or
download them. The extension does not transmit reports anywhere.

## Children's privacy

The extension collects no data and is not directed at children specifically; it processes only the
pages you choose to inspect.

## Changes

Material changes to this policy will be reflected in this file and the project CHANGELOG.

## Contact / support

Questions, bugs, and security reports: please use the project's GitHub repository.

- Issues: https://github.com/atj393/easy-web-navigation/issues
- Security: see `SECURITY.md` in the repository (report privately; do not open a public issue).

## Disclaimer

Easy Web Navigation is an inspection and assistive tool. It does **not** certify legal compliance
with WCAG, BITV, EN 301 549, the European Accessibility Act, the ADA, or Section 508, and a clean
report is not a compliance pass. This document is a privacy notice, not legal advice.
