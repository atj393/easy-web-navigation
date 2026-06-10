# Demo Plan

A short, recruiter-friendly demonstration of what KeyWise Web is for. The product is in Phase 0A, so
this plan describes the _intended_ demo once scanning lands; today it doubles as a script for walking
through the repository and demo pages.

## 60-second recruiter demo concept

The goal: in about a minute, show that keyboard accessibility is invisible until you make it visible —
and that KeyWise Web makes it visible without overclaiming.

1. **0:00–0:10 — Frame it.** "Keyboard-only users can't see where focus goes or whether controls are
   reachable. KeyWise Web is an inspection tool that makes that visible. It does not claim legal
   compliance."
2. **0:10–0:25 — Show a broken page.** Open `broken-keyboard-page.html`. Tab through it: focus is
   invisible and the order is scrambled by positive `tabindex`.
3. **0:25–0:40 — Run KeyWise Web.** Click the toolbar icon, then _Scan current page_. Point out the
   keyboard / focus / navigation summary cards and the issue list.
4. **0:40–0:50 — Show the good page.** Open `semantic-good-page.html` and scan: a clean baseline with
   a skip link, landmarks, labels, and a visible focus indicator.
5. **0:50–0:60 — Close honestly.** "This helps you _find and understand_ keyboard issues. Fixes belong
   in your source, and this is not a compliance certificate."

## Demo page list

| Page                    | What it shows                                                    |
| ----------------------- | ---------------------------------------------------------------- |
| `semantic-good-page`    | Clean baseline: skip link, main landmark, labels, visible focus. |
| `broken-keyboard-page`  | Removed focus outline + positive `tabindex` distortion.          |
| `fake-buttons-page`     | `div`s acting as buttons with no keyboard support.               |
| `modal-focus-trap-page` | Dialog used to discuss keyboard traps (2.1.2).                   |
| `form-labels-page`      | Labeled vs. unlabeled form inputs (3.3.2 / 4.1.2).               |

## Expected demo flow

1. Serve the demo pages: `pnpm -C apps/demo-sites preview` (or open the files directly).
2. Load the extension dev build: `pnpm dev`.
3. Visit each demo page, invoke the popup, and run a scan.
4. Compare the broken pages against the semantic baseline.
5. Reiterate the disclaimer: inspection and understanding, not certification.
