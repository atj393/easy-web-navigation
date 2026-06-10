# Demo Plan

A concrete, repeatable demonstration of Easy Web Navigation — designed for a portfolio walkthrough
or a short interview screen-share. The product is **read-only**; nothing in this demo modifies the
inspected page.

## Setup

```bash
pnpm install
pnpm dev                          # loads the Chromium dev build (WXT)
pnpm -C apps/demo-sites preview   # serves the demo pages at http://localhost:4321
```

Load the dev build in the browser if it isn't auto-loaded, pin the extension so the toolbar icon is
visible, and open the demo pages from `http://localhost:4321`.

## Recommended demo pages

| Page                   | Why                                                              |
| ---------------------- | ---------------------------------------------------------------- |
| `broken-keyboard-page` | Positive `tabindex` and a removed focus outline — good "before". |
| `fake-buttons-page`    | `div`s acting as buttons — clickable-not-focusable + unlabeled.  |
| `form-labels-page`     | Labeled vs. unlabeled inputs — clear forms findings.             |
| `semantic-good-page`   | Clean baseline — shows a healthy "after".                        |

## 60-second script

**0:00–0:10 — Intro.**
"This is Easy Web Navigation, a keyboard accessibility companion. It's an inspection and assistive
browsing tool — it does **not** certify compliance and it never changes the page."

**0:10–0:20 — Scan a broken page.**
Open `fake-buttons-page`, click the toolbar icon, then **Scan current page**. Point at the summary
cards (Keyboard / Navigation / Labels) and the issue list with severity badges and WCAG references.

**0:20–0:35 — Locate + focus helper.**
On an issue card, click **Locate on page** — a temporary highlight appears on the offending element.
Then click **Show focus helper** and press Tab a few times; a focus rectangle tracks the focused
element in real time.

**0:35–0:45 — Tab path.**
Click **Show tab path**. Numbered markers appear in the computed keyboard tab order; note that
positive `tabindex` elements come first. The popup shows the count (and a cap notice on large pages).

**0:45–0:55 — Developer report.**
Click **Copy Markdown report** (or **Download Markdown report**). Paste it into an editor: clean
sections, per-issue WCAG refs and recommendations, and a prominent disclaimer.

**0:55–0:60 — Honest close.**
"A clean report is **not** a compliance pass. Full accessibility still needs source-level
remediation, manual testing, and testing with real assistive technologies. This tool makes keyboard
issues visible fast — it doesn't claim to make a site compliant."

## Expected findings (quick reference)

- `fake-buttons-page`: `clickable-not-focusable`, `unlabeled-control`.
- `broken-keyboard-page`: `positive-tabindex`, plus `missing-main-landmark` / `missing-skip-link`
  depending on structure.
- `form-labels-page`: `unlabeled-form-input` for the unlabeled fields.
- `semantic-good-page`: few or no findings (still not a guarantee of accessibility).

## What to say in an interview

- It's a **monorepo** (pnpm + TypeScript) with focused packages and a WXT + React MV3 extension.
- Rules are **deterministic** and **DOM-observable**; the overlay is **isolated** and **read-only**.
- **Minimal permissions** (`activeTab`, `scripting`, `storage`) — no broad host access, no analytics,
  no AI, no remote calls.
- Tested with Vitest (jsdom) and built for Chromium and Firefox in CI.

## What NOT to claim

- Do not say it makes a site "accessible" or "compliant".
- Do not say a clean report means the page passes WCAG.
- Do not present the tab-path summary as an audit metric — it's a runtime visual aid.

See [assets/README.md](assets/README.md) for where screenshots and a demo GIF will live.
