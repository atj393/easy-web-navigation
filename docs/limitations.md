# Limitations

KeyWise Web is an **inspection and assistive browsing tool**. Being honest about what it cannot do is
a core design principle. This document is intentionally direct.

## No legal compliance claim

KeyWise Web does **not** certify legal or standards compliance with WCAG, BITV, EN 301 549, the
European Accessibility Act (EAA), the ADA, Section 508, or any other framework. Passing every check
the tool can perform does **not** mean a page is accessible or compliant. Automated and runtime
inspection can only ever cover a fraction of real accessibility, and many criteria require human
judgement. The tool is an aid to understanding, not a substitute for manual testing or expert review.

## No source-level remediation

KeyWise Web inspects the page as rendered in the browser. It does not see or change your source code,
build pipeline, component library, or CMS. It cannot "fix" the underlying cause of an issue; at most
it can, in later phases and only when explicitly enabled by the user, apply conservative runtime
aids. Durable fixes must happen in the source.

## Runtime DOM modification limits

Any runtime change lives only in the current page session and is lost on reload. Runtime
modification can also conflict with the page's own scripts and frameworks (which may re-render and
discard changes), and can mislead users into thinking a site is fixed when it is not. For these
reasons KeyWise Web defaults to read-only behavior and treats any enhancement as opt-in and minimal.

## iframe limits

Cross-origin iframes are isolated from the host page's content script by browser security policy.
KeyWise Web cannot reliably inspect content inside cross-origin frames, so issues there may be
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
avoid this, KeyWise Web does not override global keyboard behavior and does not inject ARIA
automatically.

## Why auto-fix must be conservative

Accessibility is contextual. An automatic change that looks correct in isolation can break layout,
duplicate announcements, fight the framework, or hide real problems. Overlays that promise automatic
compliance are widely criticized for exactly these reasons. KeyWise Web therefore: defaults to
inspection, makes any enhancement explicit and reversible, keeps changes minimal, and never claims to
make a site compliant.
