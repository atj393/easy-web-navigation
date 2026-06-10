# Security Policy

## Supported versions

Easy Web Navigation is pre-1.0 and moves quickly. Only the **`main` branch** (and the latest release,
once releases exist) receives security fixes.

| Version              | Supported |
| -------------------- | --------- |
| `main` (latest)      | ✅        |
| older commits / tags | ❌        |

## Reporting a vulnerability

**Please do not open a public issue for an exploitable security vulnerability.**

Instead, report it privately:

1. Preferred: open a private **GitHub Security Advisory** for this repository
   (`Security` tab → `Report a vulnerability`), if available to you.
2. Otherwise: contact the maintainer [@atj393](https://github.com/atj393) through their GitHub
   profile and request a private channel.

When reporting, please include:

- A clear description of the issue and its impact.
- Steps to reproduce (a minimal demo page is ideal).
- The browser and extension build affected.

Please **do not** include secrets, tokens, or private user data in your report. We will acknowledge
your report, investigate, and keep you informed of remediation progress.

## Privacy & security posture

Easy Web Navigation is designed to be minimal and local:

- **Permissions:** `activeTab`, `scripting`, `storage` only.
- **No broad host permissions** (`<all_urls>` is not requested). The content script is injected into
  the active tab on demand.
- **No analytics, no tracking, no telemetry.**
- **No AI calls and no remote API calls.** All analysis runs locally in the browser.
- **No speech and no recording.**
- **No page-content upload.** Reports are generated locally; you choose whether to share them.
- **Read-only.** The extension never modifies inspected page nodes; its only DOM is an isolated,
  extension-owned overlay container that is fully removed when not in use.
