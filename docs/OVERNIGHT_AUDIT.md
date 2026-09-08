# Overnight product audit

A full pass over Easy Web Navigation — engineering, UX, accessibility,
correctness, testing, security, performance and product quality — carried out
on branch `claude/easy-web-nav-overnight-hardening-edx86j`, based on
`54171ce` (`main`).

This is a working backlog, not a wish list. Every item below is either **Fixed**
(with the change and its test named) or **Open** (with a reason). Nothing is
recorded as fixed unless it was verified.

## Severity model

|        |                                                                                                      |
| ------ | ---------------------------------------------------------------------------------------------------- |
| **P0** | Security or privacy violation, page mutation, data corruption, or a crash preventing normal use.     |
| **P1** | Release-blocking UX, a seriously wrong accessibility result, an important feature broken, or RB-001. |
| **P2** | Significant UX, architecture, performance, accessibility or maintainability problem.                 |
| **P3** | Polish.                                                                                              |

## Baseline

Recorded before any change, at `54171ce`:

| Check                | Result                                                      |
| -------------------- | ----------------------------------------------------------- |
| `pnpm typecheck`     | PASS                                                        |
| `pnpm lint`          | PASS                                                        |
| `pnpm test`          | PASS — 142 tests, 9 files                                   |
| `pnpm format:check`  | **FAIL** — `README.md` (not run by any CI job)              |
| `pnpm build`         | PASS — Chromium MV3, 241.12 kB                              |
| `pnpm build:firefox` | PASS — **Firefox MV2**, 240.97 kB                           |
| `pnpm run ci`        | PASS (does not include `format:check` or the Firefox build) |

Required permissions `activeTab`, `scripting`, `storage`; no required host
permissions; optional hosts `http://*/*`, `https://*/*` (Chromium only — see
XB-001).

---

## RB-001 — Popup grows and reflows while opening

**P1 · Popup · Fixed**

**Symptom.** Opening the popup, it visibly changes size, jumps and reflows for
about three quarters of a second before settling.

**Evidence.** A browser extension popup is auto-sized: the browser repeatedly
reads the document's preferred size and resizes the popup window to match,
clamped to 800x600. Emulating that loop against the packaged extension in
Chromium, from a 100x100 start:

```
t≈123ms  popup 100x100   content wants 231x3509
t≈173ms  popup 231x600   content wants 239x1759
t≈194ms  popup 239x600   content wants 247x1740
…        (28 more rounds, each exactly +8px)
t≈821ms  popup 460x600   content wants 460x1307   ← settles
```

31 distinct widths, 30 resizes, ~700ms of visible growth. The decisive
measurement is the pair (popup width → rendered content width) at every step:

```
231→231  239→239  247→247  …  455→455  460→460
```

The content width _equalled_ the popup width at every step. It was a function
of it.

**Root cause.** `.popup { width: min(420px, calc(100vw - 32px)); padding: 20px }`
with no `box-sizing: border-box`, and no width on `html`/`body`.

- `100vw` is the popup's own width, so content width depended on popup width.
- Popup width is derived from content width, so the dependency is circular.
- Because padding sat _outside_ the declared width, each round-trip grew the
  preferred width by `40px (padding) − 32px (calc offset)` = **exactly 8px**,
  which is the step size in the trace. The loop diverged upward instead of
  converging, until `min()` clamped at 420 (+40 padding = the 460 it settled on,
  40px wider than the author intended).

Four things made it worse:

1. Content was 1307px tall in a 600px popup, so the whole popup was one long
   outer scroll; a scrollbar appearing or disappearing shifts `100vw` again.
2. Startup wrote a dozen independent `useState` values from one async effect,
   each commit changing the tree's _structure_ (a status line appearing, a page
   title appearing, a whole results block appearing) and so its preferred size.
3. `phase !== "error"` and `result &&` added and removed whole blocks.
4. No dimension was pinned anywhere in the document.

**Fix.** A deterministic popup sizing model, documented as a contract at the top
of `apps/extension/entrypoints/popup/style.css`:

- no viewport units anywhere in the popup stylesheet;
- `html`, `body` and `.shell` all carry the same explicit pixel width **and**
  height, so the preferred size is already final on the first painted frame,
  before React mounts;
- `box-sizing: border-box` globally, so padding cannot widen the shell;
- variable content scrolls inside the shell, not the popup window;
- deliberately **no** `overflow: hidden` on `html`/`body`, so that at high zoom
  (where the popup is clamped to 800x600 while the document keeps its CSS-pixel
  size) the outer document can still scroll and nothing is unreachable.

Startup was also collapsed into a single reducer with an explicit `boot` phase,
so hydration commits every persisted value at once rather than re-shaping the
tree field by field.

**Verification.**

|                                | Before  | After                             |
| ------------------------------ | ------- | --------------------------------- |
| resizes from 100x100           | 31      | 2                                 |
| resizes from 420x500           | 6       | 2                                 |
| resizes from 360x620           | 16      | 2                                 |
| distinct rendered shell widths | 30      | **1** (420, at every popup width) |
| settles at                     | 460x600 | 420x580                           |

The two remaining steps are the rig, not the product: `setViewportSize` sizes
the outer window (scrollbar included) while the browser sizes in content pixels,
so a scrollbar can cost one extra round. The size never returns to a value it
has left, which is what oscillation would look like.

**Tests.** `scripts/check-popup-stability.mjs` (real packaged browser; fails on
the pre-fix build, printing the 8px growth sequence),
`entrypoints/popup/style.test.ts` (the CSS contract as an executable guard, runs
in normal CI), `entrypoints/popup/state.test.ts` (startup is two structural
states and one commit).

---

## Correctness — the accessibility engine

### RE-001 · Disabled controls reported as unreachable

**P1 · Rules · Fixed.** `clickable-not-focusable` flagged any element with an
interactive role or `onclick` that was not focusable — including
`<button onclick disabled>` and `aria-disabled="true"`. A disabled control is
_meant_ to be out of the tab order. Now skipped, with `aria-disabled` inherited
from ancestors. Test: `dom-scanner/src/rule-correctness.test.ts`.

### RE-002 · Everything behind a modal reported as unreachable

**P1 · Rules · Fixed.** Same rule flagged controls inside an `inert` subtree —
i.e. the entire page behind an open dialog, which is exactly what `inert` is
for. Now skipped.

### RE-003 · Roving-tabindex widgets reported as broken

**P1 · Rules · Fixed.** Every inactive tab, menu item, radio and tree item with
`tabindex="-1"` was flagged, although that is precisely what the ARIA Authoring
Practices prescribe: one member in the tab order, arrows for the rest. Now
recognised when the element has a composite role, sits in its matching
container, and a sibling with the same role _is_ focusable — so a widget where
**no** member is reachable is still reported, because that one is really broken.

### RE-004 · Unlabeled dropdowns and text areas reported as labelled

**P1 · Accessible name · Fixed.** `getAccessibleName` fell back to
`el.textContent` for every element. A `<select>`'s options and a `<textarea>`'s
contents are its **value**, not its name, so an unlabeled dropdown with options
looked correctly labelled — a false negative, which is worse than a false
positive because the user believes the clean result. The same applied to a
control wrapped in a bare `<label>`, whose `textContent` includes the control's
own text. Now: name-from-content is skipped for `select`/`textarea`/`input`, and
a wrapping label's text excludes the control's own subtree.

### RE-005 · Icon buttons reported as unnamed

**P2 · Accessible name · Fixed.** `<button><svg aria-label="Close"></svg></button>`
— the ordinary icon-button pattern — was reported as having no name. Per the
accname algorithm a descendant's own `aria-label` (or `alt`) contributes to the
name. Now honoured, along with `<svg><title>`.

### RE-006 · Decorative glyphs counted as names

**P2 · Accessible name · Fixed.** `<button><span aria-hidden="true">×</span></button>`
was treated as named because `textContent` was `×`. `aria-hidden` subtrees now
contribute nothing, and `alt=""` marks an image decorative.

### RE-007 · Hidden shadow content treated as visible

**P2 · Visibility · Fixed.** `isHidden` walked `parentElement`, which stops at a
shadow-root boundary — so a control inside a component whose host is
`display: none` looked visible and was reported. The walk now steps out to the
shadow host.

### RE-008 · `positive-tabindex` reported hidden markup

**P2 · Rules · Fixed.** Alone among the rules it applied no visibility filter,
so it reported markup the user could never encounter.

### RE-009 · Invalid `tabindex` made a real button look unfocusable

**P3 · Focusability · Fixed.** HTML ignores an unparseable `tabindex`, so
`<button tabindex="abc">` is still focusable. The scanner returned `false`.

### RE-010 · `<details>` counted as focusable

**P3 · Focusability · Fixed.** `<details>` never takes focus; its `<summary>`
does. Both were counted, inflating the "items that can take keyboard focus"
figure.

### RE-011 · Only "skip" recognised as a skip link

**P3 · Rules · Fixed.** A page shipping "Jump to content" was reported as having
no skip link.

### RE-012 · `disabled` on a non-form element treated as disabling

**P3 · Focusability · Fixed.** The attribute is only meaningful on form
controls; on a `<div>` it is inert markup.

**Aggregate verification.** `apps/demo-sites/correct-widgets-page.html` was
built as a false-positive fixture — every widget on it is correct. Scanned with
the packaged extension in Chromium: **10 findings before, 0 after.**

### RE-013 · `[onclick]` on a delegation container

**P2 · Rules · Open, documented.** A `<div onclick>` that wraps a real button —
click delegation — is still reported. Ruling it out would mean guessing whether
a focusable descendant handles the interaction, and guessing wrong in the other
direction hides a genuinely unreachable control. Left as-is deliberately;
recorded in `docs/limitations.md` rather than changed on a hunch.

### RE-014 · `missing-visible-focus` is catalogued but never run

**P3 · Rules · Open by design.** Reviewed and deliberately kept. It is marked
`status: "not-implemented"`, never evaluated, never shown in the popup or a
report, and documented as deferred in `docs/limitations.md`,
`docs/roadmap.md`, `docs/wcag-keyboard-profile.md` and both sets of release
notes. It is an honest roadmap marker, not a claimed check.

---

## Product honesty

### PH-001 · Options page settings that did nothing

**P1 · Options · Fixed.** All four settings were dead. Three were labelled "not
wired yet" on screen; the fourth (`showWcagReferences`) was marked ready and was
also read nowhere. Worst was **Disabled domains**, described to the user as
"Easy Web Navigation stays inactive on these" — stored, never consulted, so the
extension carried on checking sites the user had explicitly excluded. For a
product whose entire proposition is restraint, that is the most damaging kind of
bug.

Fixed by making the two meaningful settings real and deleting the rest:

- **Show WCAG references** now drives the popup's finding detail and the
  Markdown/JSON reports.
- **Disabled sites** now works: the popup will not check them, the background
  will not auto-inject there, and the content script will not auto-apply,
  including after an SPA route change. Entries accept what people actually type
  (bare host, full URL, `*.host`, mixed case, port) and match the host plus its
  subdomains, never by substring — so `example.com` leaves `notexample.com` and
  `example.com.evil.test` alone (`lib/site-rules.test.ts`).
- The two toggles that only duplicated the popup's own guide controls were
  removed, per the rule against the same confusing control in two places.
- `enableSafeEnhancementsManually` — a setting for a mode that would _modify
  inspected pages_ — was removed outright. It should not exist in a read-only
  product, even switched off.
- A failed save now says so instead of reporting "saved".

### PH-002 · "–" placeholders that look like measurements

**P2 · Results · Fixed.** The summary cards showed `–` before a check. Users
read a dash in a number slot as a result. Now "Not checked yet".

### PH-003 · Claim accuracy

**P2 · Copy · Fixed.** Audited every user-facing string across popup, options
and reports. Nothing claims a page is accessible, passes, or is compliant. A
clean result reads "No problems were found by these checks", with an explicit
note that some keyboard problems can only be found by hand. Guarded by a test
that finds _unnegated_ claims, so "cannot confirm a page is accessible" passes
and "this page is accessible" fails (`entrypoints/popup/messages.test.ts`).

---

## Cross-browser

### XB-001 · Automatic checking could never work on Firefox

**P2 · Manifest · Fixed.** The Firefox build is Manifest V2, which has no
`optional_host_permissions` key — WXT drops it. So the manifest declared no
optional origins, `permissions.request()` was rejected outright, and the "This
website" and "All websites" scopes were permanently unavailable there. MV2
spells the same thing `optional_permissions`. Added via the manifest hook: the
same optional access already declared for Chromium, expressed in the MV2 key.
Required permissions unchanged, nothing granted without the browser's prompt.

`scripts/check-manifest.mjs` now asserts the optional hosts under the right key
per manifest version, so this cannot silently regress.

### XB-002 · Firefox is MV2, not MV3

**P3 · Manifest · Open, documented.** The product describes itself as Manifest
V3. That is true of the shipped Chromium/Edge package; the Firefox build is MV2
because that is what the current WXT target produces. Not changed overnight —
moving Firefox to MV3 affects the background worker's lifetime and needs real
Firefox testing, which is not available in this environment. Recorded in
`docs/limitations.md`.

---

## Performance

### PF-001 · Drawing keyboard-path markers thrashed layout

**P2 · Overlay · Fixed.** `showTabPath` measured each element _after_ appending
the previous marker, forcing a synchronous layout every iteration — 500 markers
meant 500 reflows. `reposition()` did the same on every scroll frame. Both are
now a strict read-then-write split with a single batched append. Guarded by a
test that records the read/write interleaving rather than wall-clock time.

### PF-002 · Scans re-resolved computed styles per ancestor

**P2 · Scanner · Fixed.** The keyboard-path visibility filter walked up to 40
ancestors per candidate calling `getComputedStyle` each time. A scan is one
synchronous read of a DOM that cannot change underneath it, so style and hidden
lookups are now memoised per pass.

**Measured in packaged Chromium, median of 3:**

| Page           | Operation                  | Before | After |      |
| -------------- | -------------------------- | -----: | ----: | ---: |
| 1801 focusable | keyboard path, 500 markers |  582ms | 124ms | −79% |
| 1801 focusable | keyboard path, 250 markers |  230ms |  99ms | −57% |
| 1801 focusable | keyboard path, 100 markers |  145ms |  82ms | −43% |
| 1801 focusable | full scan                  |  107ms |  94ms | −12% |
| 601 focusable  | keyboard path, 500 markers |  460ms |  56ms | −88% |
| 601 focusable  | full scan                  |   29ms |  22ms | −24% |
| 151 focusable  | keyboard path, 500 markers |   55ms |  11ms | −80% |

### PF-003 · Large result sets rendered in full

**P2 · Results · Fixed.** Every finding was rendered at once. Now 25 initially,
with an explicit "Show N more" — nothing is hidden, it is deferred behind a
control the user can see.

---

## Lifecycle and robustness

### LC-001 · Overlay container leaked after "locate"

**P2 · Overlay · Fixed.** `unmount()` only ran when a helper was switched off.
A "locate" flash cleared its own highlight on a timer, leaving the container and
its `scroll`/`resize` listeners attached to the page for the rest of the
session. The controller now reports when a timed highlight leaves it empty, and
the content script releases it.

### LC-002 · Overlay died when an SPA replaced `<body>`

**P2 · Overlay · Fixed.** `mount()` returned early whenever it held a container
reference, even a detached one, so the overlay silently stopped working. It now
rebuilds a detached container.

### LC-003 · Corrupted storage reached the UI

**P2 · State · Fixed.** Only `scope === "off"` was checked. An unknown scope
left the `<select>` showing one value while state held another; a non-boolean
`enabled` was trusted. Every persisted field is now validated before it reaches
the UI (`entrypoints/popup/state.test.ts`).

### LC-004 · Stale async results could overwrite the current UI

**P2 · State · Fixed.** A scan started, then superseded (popup closed, tab
changed, second check), could still write its result. Guarded by an aliveness
ref and a scan sequence number.

### LC-005 · Raw browser exceptions shown to users

**P2 · Errors · Fixed.** The old `humanizeError` matched a five-term regex and
otherwise passed the raw message through, so "Could not establish connection.
Receiving end does not exist." reached the user verbatim. Failures are now
classified (restricted / no-connection / no-tab / permission / clipboard /
unknown) and each maps to one calm sentence with a next step. Tested against
thirteen real browser messages.

### LC-006 · Download could be cancelled by its own cleanup

**P2 · Reports · Fixed.** `URL.revokeObjectURL` ran synchronously after
`click()`, which can cancel the download; the anchor was never in the document,
which Firefox requires. Both fixed, plus a filename per host and date so
repeated downloads do not overwrite each other, and a `try/catch` where there
was none.

### LC-007 · Content-script injection idempotency

**P2 · Content script · Verified, no change needed.** Driven in a real browser:
10 injections into one page produce exactly **one** overlay container and
identical scan results. The `__easyWebNavigationInitialized` guard holds.

### LC-008 · Read-only contract

**P0 if violated · Verified, no change needed.** Measured rather than asserted:
after 10 injections, 10 scans, and 5 focus-helper and keyboard-path cycles
against a real page in a real browser, the inspected page's HTML is
**byte-identical** to before, and the overlay container is gone. Also guarded by
`focus-overlay/src/contract.test.ts`, which snapshots the page excluding
extension-owned nodes.

The extension's own overlay is now excluded from the scanner's deep query
outright, so it can never contaminate the computed keyboard path.

---

## The extension's own accessibility

Audited with real `Tab` presses against the packaged extension in Chromium, in
five states: popup on a restricted page, on a normal page, with findings, at
800x600 (high zoom), and the options page.

### AX-001 · `aria-controls` pointed at panels that did not exist

**P2 · Popup · Fixed.** Every tab carried `aria-controls`, but only the selected
panel was in the DOM — two of three references dangled on every render. All
three panels are now rendered with the inactive ones `hidden`, which is the APG
shape and gives each panel its own scroll position.

### AX-002 · Heading levels skipped

**P2 · Popup · Fixed.** The outline ran H1 → H3 → H4. Section headings are now
H2 and findings H3.

### AX-003 · Scrollable panel had only the browser's default focus ring

**P3 · Popup · Fixed.** Given the same 3px ring as every other control.

**Result across all five states:** no keyboard trap (focus wraps everywhere), 0
dangling ARIA references, 0 unnamed controls, exactly 1 live region (a scan does
not fire a burst of announcements), no horizontal scroll at any size, a visible
3px focus ring on every control, a contiguous heading outline, and a focus order
of primary action → tabs → panel → panel controls → footer actions.

### AX-004 · Disabled primary action is not in the tab order

**P3 · Popup · Open by design.** On a restricted page "Check this page" is
`disabled`, so a keyboard user never lands on it. Considered and kept: the
status strip is a live region that explains why, and the panel repeats it as a
heading and a sentence. `aria-disabled` with a focusable-but-inert button would
put a dead control in the path for no gain.

---

## Information architecture and UX

### UX-001 · Results were 700px below the button that produces them

**P1 · Popup · Fixed.** The old popup was a single 1307px scroll in a 600px
window: brand, primary action, visual guides, automatic checking, _then_
results, then report actions. A user who pressed "Check this page" had to scroll
past two sections of configuration to see what they asked for.

Restructured to a fixed shell — pinned header (brand, reserved-height status
strip, primary action), a tab strip, a scrolling body, pinned footer — with
three panels: **Results**, **Guides**, **Automatic**. The primary action and the
report actions stay visible in every section. This is Option B from the brief
(stable top-level sections) crossed with Option C (the primary workflow stays in
the popup), chosen because the content genuinely did not fit one scroll and
because a fixed shell is what makes RB-001 impossible to reintroduce.

### UX-002 · Findings in rule order, not urgency order

**P2 · Results · Fixed.** Sorted most-serious-first for display. The stored
result keeps the scanner's deterministic order, so reports are unchanged.

### UX-003 · Severity had no explanation

**P2 · Results · Fixed.** Each finding now carries a plain-language sentence for
its level ("Likely to stop a keyboard user finishing a task") alongside the
badge. Severity is never conveyed by colour alone: the badge spells the level
out, and there is a forced-colors block.

### UX-004 · Privacy note as permanent footnote

**P3 · Reports · Fixed.** A standing warning in the corner is read once and then
stops registering. It now arrives with the confirmation, at the moment results
leave the popup: "Results copied. They include the page address and page text,
so check before sharing."

### UX-005 · Restricted pages surfaced as failures

**P2 · Popup · Fixed.** The popup waited for an exception, then showed whatever
the browser said. It now detects an unsupported URL at boot and shows a calm
explanation, with the shell unchanged.

---

## Engineering quality

### EQ-001 · `App.tsx` held everything

**P2 · Fixed.** 681 lines: browser calls, state, formatting and markup. Split
into `state.ts` (pure reducer and selectors), `messages.ts` (pure copy and error
classification), `page-actions.ts` (the thin browser-facing layer) and four
presentational components. The split was made where it bought testability: the
pure modules carry no extension imports, so the whole startup, scan and
monitoring lifecycle is unit-tested without a browser mock layer.

### EQ-002 · Messaging boundary was unchecked

**P2 · Fixed.** `send()` cast the response straight to `ExtensionMessage`. A
stale content script from an older version can answer with anything. Now shape-
checked at runtime.

### EQ-003 · `format:check` was in no CI job and had drifted red

**P2 · CI · Fixed.** Added to CI and to `pnpm run ci`, along with the Firefox
build and the new manifest guard.

### EQ-004 · Nothing pinned the permission surface

**P2 · CI · Fixed.** The manifest is generated from config plus whatever the
build tool infers from the entrypoints, so a dependency upgrade could widen it
unnoticed. `scripts/check-manifest.mjs` asserts the _built_ manifests for both
browsers: exactly the three permissions, no host permissions, no declared
content-script matches, the optional hosts under the right key, none of
seventeen permissions the product must never need, and no remote or eval'd code.

---

## Dependencies

Reviewed all workspace dependencies. Nothing was upgraded: none of the current
versions carries a known advisory affecting this code, and a wholesale bump is
exactly the kind of change that should not land unattended in the same PR as a
release-blocking fix.

No runtime dependency was added. The popup's component tests run on
`react-dom` and jsdom, both already present. `scripts/check-popup-stability.mjs`
uses `playwright-core` if it happens to be installed and exits 0 with a SKIP
notice otherwise, so it can be run locally or in a future CI job without making
`pnpm install --frozen-lockfile` pull a browser.

---

## Security and privacy

No change to the privacy model. Local-only, no account, no server, no telemetry,
no AI, no remote code, no network calls of any kind. Reviewed: message
validation (EQ-002), selector handling (best-effort resolution already wrapped
in `try/catch`), report generation (no page HTML, no form values — asserted by a
test), Shadow DOM isolation (`:host { all: initial }`, `pointer-events: none`,
`aria-hidden`), CSP (no `unsafe-eval`, no remote origins — asserted by the
manifest guard), and storage (only the user's own choices; no page content is
ever persisted).

The permission surface is unchanged on Chromium and is now correct on Firefox
(XB-001).

---

## Open items

| ID     | Severity | Item                                                                                                                                                                                  |
| ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RE-013 | P2       | `[onclick]` on a click-delegation container is still reported. Deliberate: the alternative hides genuinely unreachable controls.                                                      |
| XB-002 | P3       | The Firefox build is MV2. Moving it to MV3 needs real Firefox testing.                                                                                                                |
| MT-001 | P2       | Firefox and Edge runtime behaviour is unverified — neither browser is available in this environment. Both build, and both manifests are asserted.                                     |
| MT-002 | P2       | Real browser-zoom behaviour (125/150/200%) is unverified; the popup was measured at 800x600, which is the clamped size zoom produces, but not through the browser's own zoom setting. |
| RE-014 | P3       | `missing-visible-focus` remains catalogued and deferred, by design.                                                                                                                   |
| AX-004 | P3       | The disabled primary action is not in the tab order on restricted pages, by design.                                                                                                   |

`docs/OVERNIGHT_RESULT.md` carries the summary, the full test numbers, and the
release recommendation.
