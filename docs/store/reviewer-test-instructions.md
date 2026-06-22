# Reviewer test instructions (Chrome & Edge)

These steps let a store reviewer verify Easy Web Navigation end-to-end. The extension is read-only
and runs entirely locally.

## Build artifact

- Chrome: `artifacts/chrome/easy-web-navigation-chrome-v1.0.0.zip`
- Edge: `artifacts/edge/easy-web-navigation-edge-v1.0.0.zip` (identical Chromium MV3 package)

Each ZIP has `manifest.json` at its root.

## Load the extension (unpacked, for local testing)

1. Unzip the package.
2. Chrome: open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, select the
   unzipped folder. Edge: open `edge://extensions`, enable **Developer mode**, **Load unpacked**.
3. Pin **Easy Web Navigation** so the toolbar icon is visible.

## Test pages

Any normal `http`/`https` page works. The repository also includes deliberately broken demo pages
(`apps/demo-sites/`): serve them with `pnpm -C apps/demo-sites preview` (http://localhost:4321) and
open, e.g., `fake-buttons-page.html` or `form-labels-page.html`.

## Core flows

1. **Manual scan** — click the toolbar icon, then **Check this page**. Findings appear with
   severity badges and WCAG references.
2. **Keyboard focus** — click **Show keyboard focus**, press Tab a few times. A rectangle tracks the
   keyboard-focused element. Click **Hide keyboard focus** to remove it.
3. **Keyboard path** — click **Show keyboard path**. Numbered markers appear in the computed keyboard
   tab order (positive `tabindex` first). The summary reports the real number of keyboard items (e.g.
   "Showing all 78 keyboard items." or "Showing the first 100 of 342 keyboard items."). Use **Number
   of keyboard path markers** to choose 100 (recommended), 250, or 500 — while the path is visible the
   markers redraw immediately, with no need to toggle off and on. Markers are only drawn for controls
   that are actually visible: controls in a collapsed/off-canvas sidebar or other hidden/inert/clipped
   area get no marker, while normal controls above or below the viewport are still included. Hide to
   remove.
4. **Locate** — on any issue card, click **Show this problem**. The element is briefly highlighted.
5. **Copy report** — click **Copy results**, paste into an editor. A clean report with a
   non-compliance disclaimer appears.
6. **Download report** — click **Download results** to save `easy-web-navigation-report.md`.
7. **Automatic checking — this page** — choose **This page only**, click **Start automatic
   checking**; the page is checked and your enabled guides re-apply. No extra permission is requested
   for this scope. The popup clearly states that this choice checks the page you started on and that
   you may need to open the extension again after navigating to another page (it does not promise
   automatic checking across pages in this scope).
8. **Automatic checking — this website** — choose **This website**, click **Start automatic
   checking**; the browser shows an optional host-permission prompt for the current origin. Granting
   enables auto re-apply across that site; denying falls back to this-page-only with a friendly
   message.
9. **Stop automatic checking** — overlays are removed.
10. **Restricted page** — open a browser-internal page (e.g. `chrome://settings` / `edge://settings`)
    and click Scan: the extension shows a friendly "can't act on this page" message (it does not
    crash and cannot script privileged pages).

## Reviewer notes

- The extension **does not modify page source**. The only DOM insertion is an extension-owned
  overlay container used for visual highlighting; it is removed when not in use.
- **All analysis happens locally.** No remote API calls, no analytics, no AI, no page-content upload.
- **Optional host permissions** are requested only after the user chooses "This website" or "All
  websites" automatic checking — never at install time and never for manual checking.
- There is **no remote code** (no `eval`, no `new Function`, no externally hosted scripts).
