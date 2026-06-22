<div align="center">

<img src="docs/assets/easy-web-navigation-icon.png" alt="Easy Web Navigation icon" width="96" />

# Easy Web Navigation

**Keyboard Access Check**

Check how a website works with a keyboard.

A privacy-first browser extension for checking keyboard navigation, focus, and visible keyboard paths.

[![CI](https://github.com/atj393/easy-web-navigation/actions/workflows/ci.yml/badge.svg)](https://github.com/atj393/easy-web-navigation/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Chrome MV3](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/)
[![No tracking](https://img.shields.io/badge/tracking-none-lightgrey)](#privacy)

</div>

---

**Store name:** Easy Web Navigation - Keyboard Access Check

Easy Web Navigation helps you find possible keyboard-access problems, see where keyboard focus goes,
and understand the path through a page's visible controls — then copy or download the results to share
with developers or testers. It runs locally and never changes the website.

- [Quick start](#quick-start)
- [How it works](#how-it-works)
- [What it helps you check](#what-it-helps-you-check)
- [What it is not](#what-it-is-not)
- [Privacy](#privacy)
- [Permissions](#permissions)
- [Browser support](#browser-support)
- [Known limitations](#known-limitations)
- [Help and feedback](#help-and-feedback)
- [For developers](#for-developers)
- [License](#license)

---

## Quick start

Easy Web Navigation is not in the browser stores yet. Store links will be added here once each listing
is approved.

| Store                  | Status      |
| ---------------------- | ----------- |
| Chrome Web Store       | Coming soon |
| Microsoft Edge Add-ons | Coming soon |

In the meantime you can try it by loading a production build **unpacked**:

1. Build the extension (see [For developers](#for-developers)) or use a build you already have in
   `apps/extension/.output/chrome-mv3/`.
2. Open `chrome://extensions` (or `edge://extensions`) and turn on **Developer mode**.
3. Click **Load unpacked** and select the build folder.
4. Pin **Easy Web Navigation** and open any website to start.

> Everyday use does not require Node.js — that is only needed for the build step above.

## How it works

1. **Open a website.**
2. **Select “Check this page”.**
3. **Review** possible problems, keyboard focus, and the keyboard path.

Everything runs locally in your browser. Easy Web Navigation does not change the website.

## What it helps you check

- **Keyboard use** — controls that can be operated with a keyboard.
- **Keyboard focus** — a clear highlight showing where focus is right now.
- **Keyboard path** — numbered markers showing the order the Tab key moves through visible controls.
- **Navigation** — page structure that helps people move around (landmarks, skip links).
- **Names and labels** — whether buttons, links, and form fields have understandable names.
- **Results you can copy or download** — a readable summary to share with developers or testers.

## What it is not

- It does not change a website.
- It does not fix a website automatically.
- It does not replace manual accessibility testing.
- It does not certify legal compliance.

A clean result means only that these checks found nothing. It does not guarantee that a website is
accessible.

## Privacy

Easy Web Navigation is private by design — it runs locally and uploads nothing.

| Information            | What happens                                     |
| ---------------------- | ------------------------------------------------ |
| Website content        | Processed locally in your browser; not uploaded. |
| Your preferences       | Stored locally in browser extension storage.     |
| Results                | Copied or downloaded only when you choose.       |
| Analytics and tracking | None.                                            |
| Remote processing      | None.                                            |
| AI                     | None.                                            |

There is no account, no sign-in, and no remote server. See [SECURITY.md](SECURITY.md) for the security
policy.

## Permissions

| Permission  | Why it is needed                                  |
| ----------- | ------------------------------------------------- |
| `activeTab` | Check the page you choose.                        |
| `scripting` | Run the read-only checker on the page you choose. |
| `storage`   | Remember your preferences locally.                |

- No broad host permissions are required for normal page checking.
- Optional browser access (`http://*/*`, `https://*/*`) is requested **only** when you choose
  automatic checking for “This website” or “All websites” — never at install time and never for a
  single page check.
- No permission is used for analytics, advertising, tracking, or remote processing.

## Browser support

- **Google Chrome** (Manifest V3)
- **Microsoft Edge** (Manifest V3, same package as Chrome)
- **Mozilla Firefox** — a development build exists today; published Firefox support is planned.
- Store availability is **coming soon** (see [Quick start](#quick-start)).

## Known limitations

- Browser-internal pages (for example `chrome://` or `edge://`) cannot be checked.
- A clean result is not a compliance certificate.
- “This page only” automatic checking may require opening the extension again after you move to
  another page.
- The keyboard path is a visual snapshot and may need refreshing after the page changes.
- It does not replace manual testing with real users and assistive technologies.

See [docs/limitations.md](docs/limitations.md) for the full, honest list.

## Help and feedback

Found a problem or have an idea? Please open an issue:

- **Issues:** https://github.com/atj393/easy-web-navigation/issues
- **How to report well:** see [SUPPORT.md](SUPPORT.md).
- **Security concerns:** follow the [Security Policy](SECURITY.md) and report privately.

> When sharing a report or screenshot, please **remove anything private first** — do not post
> passwords, private documents, customer data, tokens, or confidential website content.

## For developers

A pnpm + TypeScript monorepo with a WXT + React **Manifest V3** extension and focused analysis
packages. The extension is strictly **read-only**: it never mutates inspected page nodes, changes tab
order, or injects ARIA — the only DOM it creates is its own isolated, extension-owned overlay
container.

### Setup

```bash
pnpm install
pnpm dev            # Chrome/Edge dev build (WXT)
pnpm dev:firefox    # Firefox dev build
```

Then load the unpacked build from `apps/extension/.output/` in your browser's extension page
(Developer mode → Load unpacked).

### Common scripts

| Script                 | Description                                      |
| ---------------------- | ------------------------------------------------ |
| `pnpm dev`             | Run the extension in development (Chromium).     |
| `pnpm build`           | Production build (Chromium / MV3).               |
| `pnpm build:firefox`   | Production build (Firefox).                      |
| `pnpm typecheck`       | Type-check every workspace package.              |
| `pnpm lint`            | Lint the repository with ESLint.                 |
| `pnpm test`            | Run the Vitest unit tests.                       |
| `pnpm run ci`          | typecheck → lint → test → build.                 |
| `pnpm release:all`     | Build + package store ZIPs into `artifacts/`.    |
| `pnpm release:inspect` | Validate existing store ZIPs (manifest at root). |

> Use `pnpm run ci` (not `pnpm ci` — `ci` is a reserved pnpm command).

### Documentation

- [Architecture](docs/architecture.md) — messaging flow, overlay model, permissions/security.
- [Limitations](docs/limitations.md) — what the tool can and cannot detect (honest scope).
- [Contributing](CONTRIBUTING.md) — setup, scope, workflow, PR checklist.
- [Security](SECURITY.md) — how to report a vulnerability and the privacy posture.
- [Store documentation](docs/store/) — listings, privacy policy, permission justifications, checklists.
- [Brand assets](assets/brand/README.md) — the canonical icon source and how variants are generated.

## License

Easy Web Navigation is released under the **MIT License**.

Commercial use, modification, and distribution are allowed under the MIT License, provided that the
license and copyright notice are retained. The software is provided without warranty. See
[LICENSE](LICENSE).
