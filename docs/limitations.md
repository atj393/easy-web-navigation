# Limitations

Easy Web Navigation is an **inspection and assistive browsing tool**. Being honest about what it cannot do is
a core design principle. This document is intentionally direct.

## No legal compliance claim

Easy Web Navigation does **not** certify legal or standards compliance with WCAG, BITV, EN 301 549, the
European Accessibility Act (EAA), the ADA, Section 508, or any other framework. Passing every check
the tool can perform does **not** mean a page is accessible or compliant. Automated and runtime
inspection can only ever cover a fraction of real accessibility, and many criteria require human
judgement. The tool is an aid to understanding, not a substitute for manual testing or expert review.

## No source-level remediation

Easy Web Navigation inspects the page as rendered in the browser. It does not see or change your source code,
build pipeline, component library, or CMS. It cannot "fix" the underlying cause of an issue; at most
it can, in later phases and only when explicitly enabled by the user, apply conservative runtime
aids. Durable fixes must happen in the source.

## Runtime DOM modification limits

Any runtime change lives only in the current page session and is lost on reload. Runtime
modification can also conflict with the page's own scripts and frameworks (which may re-render and
discard changes), and can mislead users into thinking a site is fixed when it is not. For these
reasons Easy Web Navigation defaults to read-only behavior and treats any enhancement as opt-in and minimal.

## iframe limits

Cross-origin iframes are isolated from the host page's content script by browser security policy.
Easy Web Navigation cannot reliably inspect content inside cross-origin frames, so issues there may be
invisible to it.

## Shadow DOM limits

Closed shadow roots are not accessible to scripts. Open shadow roots require explicit traversal and
add complexity. Coverage of web-component internals will be partial and is not guaranteed.

## Dynamic / SPA limits

Single-page apps mutate the DOM continuously. A scan is a snapshot in time; results can become stale
as the app re-renders, routes change, or content loads asynchronously. Inspection reflects the moment
it ran, not the application as a whole.

## Native / screen-reader conflict risks

Overriding keyboard behavior or injecting ARIA at runtime can interfere with assistive technology
that is already interpreting the page, producing _worse_ experiences for screen-reader users. To
avoid this, Easy Web Navigation does not override global keyboard behavior and does not inject ARIA
automatically.

## Why auto-fix must be conservative

Accessibility is contextual. An automatic change that looks correct in isolation can break layout,
duplicate announcements, fight the framework, or hide real problems. Overlays that promise automatic
compliance are widely criticized for exactly these reasons. Easy Web Navigation therefore: defaults to
inspection, makes any enhancement explicit and reversible, keeps changes minimal, and never claims to
make a site compliant.

## Scanner limitations (Phase 0B)

The Phase 0B scanner is deliberately conservative and deterministic, which means it under-reports
rather than guesses:

- **DOM-observable only.** Rules act on what is visible in the DOM (attributes, roles, text, simple
  structure). Easy Web Navigation does not — and cannot reliably — detect JavaScript click handlers added
  via `addEventListener`, so some "fake buttons" wired up purely in script will not be flagged.
- **Accessible name is a pragmatic subset.** Name computation covers the common cases
  (`aria-labelledby`, `aria-label`, `label[for]` / wrapping `<label>`, button `value`, image `alt`,
  inline `<svg><title>`); it is not a full implementation of the ARIA accessible-name algorithm.
- **Visibility is best-effort.** Hidden detection uses the `hidden` attribute, `aria-hidden`,
  `type="hidden"`, and computed `display` / `visibility`. Without layout (e.g. headless test
  environments), off-screen or zero-size elements may still be treated as visible.
- **`missing-skip-link` is conservative.** It only fires when there is nav/header content to bypass
  and no recognizable skip link, to avoid false positives on simple pages.
- **Open shadow DOM only.** Open shadow roots are traversed; closed shadow roots and cross-origin
  iframes are not inspected (see the shadow DOM and iframe sections above).
- **A clean scan is not a pass.** Zero issues means only that the implemented rules found nothing —
  it is never a statement of accessibility or legal compliance.

## Focus helper limitations (Phase 0C)

The focus helper and issue locator are **visual aids only**:

- **Visual-only, not a fix.** The overlay draws rectangles in an extension-owned layer. It does not
  change the page, does not improve the page's own focus indicator, and does not remediate any
  source-level accessibility problem.
- **Not a compliance result.** Seeing a focus rectangle from Easy Web Navigation does **not** mean the page
  satisfies "Focus Visible" (2.4.7). Easy Web Navigation supplies its own indicator for inspection; it does
  not score whether the site's native focus styling is sufficient (`missing-visible-focus` is still
  deferred).
- **Restricted pages.** Browser-internal pages (`chrome://`, `edge://`, `about:`), the extension
  gallery, and other privileged origins cannot be scripted, so the helper and locate will report a
  friendly failure there.
- **Closed shadow DOM / cross-origin iframes.** The focus helper cannot observe focus inside closed
  shadow roots or cross-origin iframes, and "locate" resolves selectors in the main document and
  open shadow roots only.
- **Locate is best-effort.** If the page changed since the scan and the selector no longer matches,
  locate reports that the element is no longer present rather than guessing.

## Tab-path limitations (Phase 0D)

The tab-path visualization is a read-only approximation:

- **Computed, not observed.** The order is computed from currently detectable focusable elements
  (DOM order + `tabindex`), not by actually pressing Tab. It does not guarantee exact browser or
  assistive-technology behavior in every edge case (e.g. complex `inert`, `contenteditable`,
  scroll-container, or custom-widget focus management).
- **Snapshot in time.** Markers reflect the page when you toggled the tab path on. If the page
  changes afterward, toggle it off and on again to recompute (no `MutationObserver` in this phase).
- **Capped for performance.** Large pages are capped (default 100 items); the popup shows how many
  of the total detected items are displayed. The cap avoids rendering hundreds of markers.
- **Open shadow DOM / cross-origin iframes.** Elements inside closed shadow roots or cross-origin
  iframes are not included; open shadow roots are traversed best-effort and may not interleave in
  perfect document order.
- **Visual only.** The markers do not change the page's tab order or fix anything; they only make
  the detected order visible.

## Report limitations (Phase 0E)

The exported report is a developer aid, not an audit:

- **Reflects one scan.** A report contains only what the implemented rules found at scan time. A
  clean report is **not** a compliance pass and is not a substitute for source-level remediation,
  manual testing, or testing with real assistive technologies.
- **Tab-path summary is a visual aid.** When included, the tab-path summary (shown / total detected
  / capped) is explicitly labeled as a runtime visual aid, not an audit metric.
- **Clipboard copy can fail.** The async Clipboard API may be unavailable (older browsers, insecure
  contexts); the popup falls back to a temporary textarea + `execCommand("copy")` and, if that also
  fails, tells the user that download is still available. No automatic copying happens without a
  user action.
