# Chrome Web Store — listing (copy-paste ready)

Paste these into the Chrome Web Store Developer Dashboard. Nothing here is
submitted automatically.

## Extension name

Easy Web Navigation - Keyboard Access Check

## Short description (≤ 132 characters)

Check keyboard focus, keyboard paths, and navigation on web pages.

## Category

Accessibility (fallback: Developer Tools)

## Language

English

## Detailed description

Easy Web Navigation is a read-only keyboard accessibility companion for Chrome. It helps users and
developers inspect how a page behaves for keyboard-only navigation — where focus goes, whether it is
visible, the tab order, navigation structure, and whether controls have accessible names.

It is an inspection and assistive browsing tool. It does not modify the websites you visit, and it is
not an accessibility overlay or an automatic fixer.

What you can do:

• Scan the current page — run a read-only scan that reports issues for deterministic WCAG 2.2
keyboard-profile checks: clickable elements that aren't keyboard focusable, controls and form
fields without accessible names, positive tabindex, missing main landmark, and missing skip link.
• See the focus helper — toggle a visual rectangle that follows the keyboard-focused element as you
press Tab, so you can see exactly where focus is.
• Visualize the tab path — draw numbered markers in the computed keyboard tab order.
• Locate an issue — highlight the element behind any finding directly on the page.
• Export a developer report — copy or download a clean Markdown report of the findings.
• Monitoring mode — optionally start monitoring so the extension re-applies your chosen visual
helpers and scans supported pages as you browse, within a scope you control.

Privacy-first and local:

• All analysis runs locally in your browser. No page content is uploaded.
• No analytics, no tracking, no AI calls, no remote API calls, no account.
• Settings are stored locally; reports are generated locally and only copied or downloaded by you.

Permissions:

• activeTab + scripting — inspect the current tab only when you act (click the toolbar button).
• storage — remember your preferences locally.
• Optional host permissions (http/https) — requested only if you choose "This site" or "All
supported websites" monitoring. Manual scanning never needs them.

Limitations (honest by design):

• A clean report is NOT a compliance pass. Easy Web Navigation does not certify legal compliance with
WCAG, BITV, EN 301 549, the EAA, the ADA, or Section 508.
• Full accessibility requires source-level remediation, manual testing, and testing with real
assistive technologies.
• It cannot scan browser-internal/privileged pages (e.g. chrome:// pages).

## Single purpose

Easy Web Navigation helps users and developers inspect keyboard accessibility issues on web pages
using local, read-only scanning and optional visual helpers.

## Search terms / keywords

accessibility, keyboard navigation, WCAG, focus order, tab order, a11y, developer tools,
web accessibility

## Permission justifications (summary)

- **activeTab** — Inspect the page in the active tab only after the user invokes the extension.
- **scripting** — Inject the read-only inspection content script into the active tab on demand.
- **storage** — Persist user preferences (helper toggles, monitoring scope) locally.
- **optional*host_permissions (http://*/\*, https://\_/\*)** — Requested only when the user opts into
  "This site" or "All websites" monitoring; enables re-applying helpers across pages.

See `permission-justifications.md` for the full per-permission detail.

## Are you using remote code?

No. Easy Web Navigation does not load or execute remotely hosted code. All scripts are packaged in
the extension. There is no `eval`, no `new Function`, and no externally hosted scripts.

## Data usage / privacy

No personal or sensitive user data is collected, sold, or transmitted, and none is used for
analytics. The extension processes the active page's DOM locally to produce accessibility findings.
Settings are stored locally. Reports are generated locally and are only copied to the clipboard or
downloaded by explicit user action. See `privacy-policy.md` and `privacy-disclosure.md`.
