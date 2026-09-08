# Easy Web Navigation — Overnight Result

## Executive summary

The release blocker is fixed, and the fix is measured rather than asserted: the
popup used to resize itself about thirty times over three quarters of a second
every time it opened, and now settles once. The cause was a genuine circular
dependency — the popup's width was computed from `100vw`, and `100vw` _is_ the
popup's width — so the browser walked the loop 8px at a time until it hit a
clamp. That is now impossible by construction, and guarded by a check that fails
on the old build and passes on this one.

Three other things turned out to matter as much:

1. **The scanner was reporting correct code as broken.** Disabled controls,
   everything behind an `inert` modal, and every roving-tabindex tab, menu item
   and radio — the patterns the ARIA Authoring Practices actually prescribe — were
   all flagged. A new fixture page of correctly-built widgets went from **10
   findings to 0**.

2. **The scanner was also missing real problems.** An unlabeled `<select>` was
   treated as labelled by its own option text. That is a false negative, and a
   false negative in an accessibility tool is worse than a false positive: the
   user believes the clean result.

3. **Every setting on the options page did nothing.** Including "Disabled
   domains", which told the user the extension would stay inactive on those sites
   and then checked them anyway. For a product whose whole proposition is
   restraint, that was the most damaging bug found.

Permissions are unchanged on Chromium. The privacy model is unchanged. The
read-only contract is unchanged — and is now verified in a real browser rather
than asserted in a comment.

## Repository

|          |                                                     |
| -------- | --------------------------------------------------- |
| Base     | `54171ce5792492ec7f86c82b81eef741ad96d175` (`main`) |
| Branch   | `claude/easy-web-nav-overnight-hardening-edx86j`    |
| Commits  | 6                                                   |
| Draft PR | see the PR link in the session summary              |

---

## RB-001 — Popup fluctuation

### Before

Clicking the toolbar icon, the popup appeared small and then grew, jumping and
reflowing for roughly 0.75s before settling — 40px wider than the author had
specified.

### Reproduction

A browser extension popup is auto-sized: the browser repeatedly reads the
document's preferred size and resizes the popup window to match, clamped to
800x600. `scripts/check-popup-stability.mjs` loads the packaged extension into
real Chromium and emulates that loop.

```
pnpm build
node scripts/check-popup-stability.mjs
```

### Measurements

From a 100x100 cold start, against the pre-fix build:

|      t | popup                                 | content wants      |
| -----: | ------------------------------------- | ------------------ |
| ~123ms | 100x100                               | 231x3509           |
| ~173ms | 231x600                               | 239x1759           |
| ~194ms | 239x600                               | 247x1740           |
|      … | _(28 more rounds, each exactly +8px)_ |                    |
| ~821ms | 460x600                               | 460x1307 — settles |

The decisive measurement is the pair _(popup width → rendered content width)_ at
every sampled step:

```
231→231   239→239   247→247   …   455→455   460→460
```

The content width **equalled** the popup width at every step. It was a function
of it.

### Root cause

```css
.popup {
  width: min(420px, calc(100vw - 32px)); /* 100vw IS the popup's width */
  padding: 20px; /* outside the width: no border-box */
}
```

with no width or height on `html` or `body`.

- Content width depended on popup width; popup width was derived from content
  width. Circular.
- Because padding sat outside the declared width, each round-trip grew the
  preferred width by `40px (padding) − 32px (calc offset)` = **exactly 8px** —
  the step size visible in the trace. The loop diverged upward rather than
  converging, until `min()` clamped at 420 (+40 padding = the 460 it settled on).

Four things compounded it: content was 1307px tall in a 600px popup so the whole
popup was one long outer scroll (a scrollbar appearing shifts `100vw` again);
startup wrote a dozen independent `useState` values from one async effect, each
commit changing the tree's _structure_; conditional blocks appeared and
disappeared; and no dimension was pinned anywhere.

### Fix

A deterministic sizing model, written as a contract at the top of
`apps/extension/entrypoints/popup/style.css`:

- no viewport units anywhere in the popup stylesheet;
- `html`, `body` and `.shell` all carry the same explicit pixel width **and**
  height, so the preferred size is final on the first painted frame, before React
  mounts;
- `box-sizing: border-box` globally;
- variable content scrolls inside the shell, not the popup window;
- deliberately **no** `overflow: hidden` on `html`/`body`, so at high zoom (where
  the popup is clamped to 800x600 while the document keeps its CSS-pixel size)
  the outer document can still scroll and nothing is unreachable.

Startup was collapsed into one reducer with an explicit `boot` phase, so every
persisted value is applied in a single commit.

### After

|                                |  Before |   After |
| ------------------------------ | ------: | ------: |
| Resizes from 100x100           |      31 |       2 |
| Resizes from 420x500           |       6 |       2 |
| Resizes from 360x620           |      16 |       2 |
| Distinct rendered shell widths |      30 |   **1** |
| Settles at                     | 460x600 | 420x580 |

### Remaining variation

Two settling steps rather than one, in every case. That is the rig, not the
product: `setViewportSize` sizes the outer window (scrollbar included) while the
browser sizes in content pixels, so a scrollbar appearing or disappearing costs
one extra round. The size never returns to a value it has left, which is what
oscillation looks like, and the rendered shell measures 420 whether the popup is
100 or 420 wide.

### Regression protection

|                                        |                                                                                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `scripts/check-popup-stability.mjs`    | Real packaged browser. Fails on the pre-fix build and prints the 8px growth sequence as the failure message.                         |
| `entrypoints/popup/style.test.ts` (11) | The CSS contract as an executable guard — no viewport units, explicit dimensions, border-box, internal scrolling. Runs in normal CI. |
| `entrypoints/popup/state.test.ts` (31) | Startup is exactly two structural states, and every persisted value is applied in one commit.                                        |

---

## Product improvements

### Popup

- Fixed shell: pinned header (brand, reserved-height status strip, primary
  action), a Results / Guides / Automatic tab strip, a scrolling body, pinned
  report actions. The old popup was a single 1307px scroll in a 600px window,
  with the findings roughly 700px _below_ the button that produced them, behind
  two sections of configuration.
- One reserved-height status strip carries every transient message, so nothing
  below it moves when a message appears.
- Design tokens, a dark palette (every colour token has a dark counterpart,
  asserted by a test), and a forced-colors block for Windows high contrast.

### Page checking

- Restricted pages are detected at boot and explained calmly, instead of waiting
  for an exception and showing whatever the browser said.
- A superseded scan can no longer overwrite the current result.

### Results

- Ordered most serious first for display; the stored result keeps the scanner's
  order so reports are unchanged.
- 25 rendered initially with an explicit "Show N more" — deferred behind a
  visible control, not hidden.
- "Not checked yet" instead of a dash that reads as a measurement.
- Each finding carries a plain-language sentence for its severity. Severity is
  never conveyed by colour alone.

### Keyboard focus and keyboard path

- The overlay no longer leaks its container and scroll listeners after a "locate"
  flash, and rebuilds itself when a single-page app replaces `<body>`.
- The extension's own overlay is excluded from the scanner's deep query, so it
  can never contaminate the computed path.

### Automatic checking

- Works on Firefox for the first time (see Permissions below).
- Respects the per-site opt-out, including after an SPA route change.

### Reports

- Carry the tool version and rule profile.
- Honour the "Show WCAG references" preference.
- Saving no longer revokes the object URL before the download starts, keeps the
  anchor in the document so Firefox follows it, and names the file per host and
  date so repeated saves do not overwrite each other.
- The privacy warning now arrives with the confirmation, at the moment results
  leave the popup, rather than as a permanent footnote nobody reads twice.

### Options

- Every remaining control changes real behaviour. Dead settings were removed
  rather than left on screen implying behaviour that did not exist.
- A failed save says so instead of reporting "saved".

### Accessibility

- Each tab's `aria-controls` now resolves; heading levels no longer skip; the
  scrollable panel has the same focus ring as every other control.

### Performance

- See the table below.

---

## Bugs fixed

| Symptom                                         | Root cause                                                   | Fix                                                                                                 | Test                                         |
| ----------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Popup grows and jumps while opening             | `100vw` inside an auto-sized popup, plus content-box padding | Explicit sizing contract                                                                            | `style.test.ts`, `check-popup-stability.mjs` |
| Disabled control reported unreachable           | Rule checked only focusability                               | Skip disabled / `aria-disabled`                                                                     | `rule-correctness.test.ts`                   |
| Everything behind a modal reported unreachable  | Same                                                         | Skip `inert` subtrees                                                                               | same                                         |
| Every inactive tab / menu item / radio reported | Same                                                         | Recognise roving tabindex, but still report a widget with no reachable member                       | same                                         |
| Unlabeled `<select>` reported as labelled       | `textContent` used as the accessible name                    | Name-from-content skipped for `select`/`textarea`/`input`; wrapping-label text excludes the control | same                                         |
| Icon button reported as unnamed                 | Descendant `aria-label` ignored                              | Honour it, per accname                                                                              | same                                         |
| Decorative glyph counted as a name              | `aria-hidden` subtrees included                              | Exclude them                                                                                        | same                                         |
| Hidden shadow content reported                  | Visibility walk stopped at the shadow boundary               | Step out to the host                                                                                | same                                         |
| Hidden markup reported by `positive-tabindex`   | No visibility filter on that rule alone                      | Added                                                                                               | same                                         |
| `tabindex="abc"` made a button look unfocusable | Invalid value treated as a value                             | HTML ignores it                                                                                     | same                                         |
| Excluded sites still checked                    | `disabledDomains` stored, never read                         | Enforced in popup, background and content script                                                    | `site-rules.test.ts`                         |
| Corrupted storage desynced the UI               | Only `scope === "off"` checked                               | Validate every field                                                                                | `state.test.ts`                              |
| Raw browser exceptions shown to users           | Regex passthrough                                            | Classify failures; one sentence each                                                                | `messages.test.ts`                           |
| Download cancelled by its own cleanup           | Synchronous `revokeObjectURL`; anchor never in the document  | Both fixed                                                                                          | —                                            |
| Overlay container leaked after "locate"         | `unmount()` only ran on helper toggle-off                    | Idle callback                                                                                       | `contract.test.ts`                           |
| Overlay dead after an SPA body swap             | `mount()` returned early on a detached container             | Rebuild it                                                                                          | same                                         |
| `aria-controls` dangled on two of three tabs    | Only the selected panel was rendered                         | Render all, hide inactive                                                                           | real-browser audit                           |
| Heading levels skipped H1 → H3                  | —                                                            | H2 sections, H3 findings                                                                            | same                                         |
| Automatic checking impossible on Firefox        | MV2 has no `optional_host_permissions`                       | Declare under `optional_permissions`                                                                | `check-manifest.mjs`                         |
| `format:check` red on `main`                    | In no CI job                                                 | Added to CI and `pnpm run ci`                                                                       | —                                            |

---

## Accessibility engine

**False positives fixed:** disabled and `aria-disabled` controls; `inert`
subtrees; roving-tabindex members (tabs, menu items, radios, tree items, list
options); icon buttons labelled on the icon; invalid `tabindex` on a natively
focusable element; `<details>` counted alongside its `<summary>`; `disabled` on a
non-form element; hidden markup reported by `positive-tabindex`; "Jump to
content" not recognised as a skip link.

**False negatives fixed:** unlabeled `<select>` named by its options; `<textarea>`
named by its contents; a control wrapped in a bare `<label>` named by its own
text; decorative `aria-hidden` glyphs counted as names; controls inside a hidden
shadow host treated as visible.

**Measured aggregate.** `apps/demo-sites/correct-widgets-page.html` was built as
a false-positive fixture — every widget on it is correct. Scanned with the
packaged extension in Chromium:

|               |                                            Findings |
| ------------- | --------------------------------------------------: |
| `origin/main` | 10 (9 clickable-not-focusable, 1 unlabeled-control) |
| this branch   |                                               **0** |

**Wording.** Nothing in the popup, options page or reports claims a page is
accessible, passes, or is compliant. A clean result reads "No problems were found
by these checks", with an explicit note that some keyboard problems can only be
found by hand. Guarded by a test that looks for _unnegated_ claims, so "cannot
confirm a page is accessible" passes and "this page is accessible" fails.

**Deliberately unchanged.** `[onclick]` on a click-delegation container is still
reported; ruling it out means guessing whether a focusable descendant handles the
interaction, and guessing wrong in the other direction hides a genuinely
unreachable control. `missing-visible-focus` remains catalogued and never
evaluated — it is documented as deferred in four places and never shown to a
user. Both are written up in `docs/limitations.md` rather than changed on a hunch.

---

## Permissions

### Before

|                |                                                                                      |
| -------------- | ------------------------------------------------------------------------------------ |
| Required       | `activeTab`, `scripting`, `storage`                                                  |
| Required hosts | none                                                                                 |
| Optional hosts | `http://*/*`, `https://*/*` — **Chromium only**; the Firefox MV2 build declared none |

### After

|                |                                                  |
| -------------- | ------------------------------------------------ |
| Required       | `activeTab`, `scripting`, `storage` — unchanged  |
| Required hosts | none — unchanged                                 |
| Optional hosts | `http://*/*`, `https://*/*` on **both** browsers |

**The only difference** is that the Firefox build now declares the optional
origins it always intended to have. Manifest V2 has no
`optional_host_permissions` key, so WXT dropped it, the manifest declared
nothing, `permissions.request()` was rejected outright, and the "This website"
and "All websites" scopes could never be granted on Firefox. MV2 spells the same
thing `optional_permissions`.

This is parity, not expansion: the same optional access already declared for
Chromium, expressed in the key that browser reads. Nothing is granted until the
user accepts the browser's own prompt, and no required permission changed.

`scripts/check-manifest.mjs` now asserts the built manifests for both browsers —
exactly those three permissions, no host permissions, no declared content-script
matches, the optional hosts under the right key per manifest version, none of
seventeen permissions the product must never need, and no remote or eval'd code.
It runs in CI.

---

## Privacy

**Privacy model changed: NO.**

Local-only. No account, no server, no telemetry, no analytics, no AI, no remote
code, no network calls of any kind. Nothing about the inspected page is
transmitted or persisted; storage holds only the user's own choices.

Two improvements _to_ privacy, neither of which changes the model:

- The per-site opt-out now actually works, so a site the user excludes is never
  injected into, scanned, or drawn on.
- Reports state what they contain — page address, selectors, short element
  previews — and the warning appears at the moment results leave the popup. Form
  values, credentials and full page HTML are still never included, now asserted by
  a test.

---

## Tests

|                                    |                                                   |
| ---------------------------------- | ------------------------------------------------- |
| TypeScript                         | PASS                                              |
| ESLint                             | PASS                                              |
| Formatting                         | PASS — was **failing** on `main`                  |
| Vitest                             | PASS — **281 tests**, 16 files (was 142 across 9) |
| Chromium build                     | PASS                                              |
| Firefox build                      | PASS                                              |
| Manifest guard                     | PASS — both browsers                              |
| `pnpm run ci`                      | PASS                                              |
| Popup stability, packaged Chromium | PASS — fails on the pre-fix build                 |
| Chrome smoke, packaged extension   | PASS — see below                                  |

Verified in a real browser against real pages, driving the packaged extension:

- **Injection idempotency.** 10 injections into one page leave exactly **one**
  overlay container and return identical scan results.
- **Read-only contract.** After 10 injections, 10 scans, and 5 focus-helper and
  keyboard-path cycles, the inspected page's HTML is **byte-identical** to before,
  and the overlay container is gone.
- **Keyboard audit.** Five popup and options states walked with real `Tab`
  presses: no keyboard trap anywhere, 0 dangling ARIA references, 0 unnamed
  controls, exactly 1 live region, no horizontal scroll at any size, a visible 3px
  focus ring on every control, and a contiguous heading outline.
- **Demo fixtures.** All nine demo pages scanned; each reports what it is designed
  to report, and the large fixture correctly excludes exactly the two controls
  that are in the tab order but not visible (1204 focusable, 1202 in the path).

---

## Performance

Median of 3, packaged extension in real Chromium.

| Page           | Operation                  | Before | After |          |
| -------------- | -------------------------- | -----: | ----: | -------: |
| 1801 focusable | keyboard path, 500 markers |  582ms | 124ms | **−79%** |
| 1801 focusable | keyboard path, 250 markers |  230ms |  99ms |     −57% |
| 1801 focusable | keyboard path, 100 markers |  145ms |  82ms |     −43% |
| 1801 focusable | full scan                  |  107ms |  94ms |     −12% |
| 601 focusable  | keyboard path, 500 markers |  460ms |  56ms | **−88%** |
| 601 focusable  | keyboard path, 250 markers |  152ms |  36ms |     −76% |
| 601 focusable  | full scan                  |   29ms |  22ms |     −24% |
| 151 focusable  | keyboard path, 500 markers |   55ms |  11ms |     −80% |

Two causes. The overlay measured each element _after_ appending the previous
marker, forcing a synchronous layout every iteration — 500 markers meant 500
reflows, and the same happened on every scroll frame. And the keyboard-path
visibility filter re-resolved computed styles for up to 40 ancestors of every
candidate. Drawing is now a strict read-then-write split with one batched append
(guarded by a test that records the read/write interleaving rather than
wall-clock time), and a scan memoises style and visibility lookups per pass.

Popup startup: the interactive UI now commits once, after a storage read and a
`tabs.query` — neither of which waits on the inspected page.

---

## Screenshots

In `docs/assets/overnight/`:

| File                     | What it shows                                                                                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `popup-before.png`       | Before, at its settled 460x600. The result count is at the top but the findings are ~700px further down, below the visual-guide and automatic-checking sections. |
| `popup-after.png`        | After: a fixed 420x580 shell, findings directly under the primary action, report actions pinned.                                                                 |
| `popup-after-guides.png` | The Guides panel.                                                                                                                                                |
| `popup-after-dark.png`   | The dark palette.                                                                                                                                                |

Stills only. RB-001 is a motion problem; its evidence is the measurements above
and the check that reproduces them.

---

## Remaining issues

| Severity | Item                                                                                                                                                                                                                                                                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P2**   | **Firefox and Edge runtime are unverified.** Both build, both manifests are asserted, and the Firefox optional-permission fix is exactly the kind of change that wants a real runtime test. Neither browser is available in this environment.                                                                                                     |
| **P2**   | **Browser zoom is unverified.** The popup was measured at 800x600 — the clamped size high zoom produces — but not driven through the browser's own zoom setting at 125 / 150 / 200%. The design should hold (fixed px scale with zoom, and the outer document is deliberately left scrollable so nothing is clipped) but it has not been watched. |
| **P2**   | `[onclick]` on a click-delegation container is still reported. Deliberate; documented.                                                                                                                                                                                                                                                            |
| **P3**   | The Firefox build is Manifest V2 while the product describes itself as MV3. True of the shipped Chromium/Edge package. Moving Firefox to MV3 changes the background worker's lifetime and needs real Firefox testing first.                                                                                                                       |
| **P3**   | `missing-visible-focus` remains catalogued and never evaluated, by design and documented in four places.                                                                                                                                                                                                                                          |
| **P3**   | Dependencies were reviewed and deliberately not upgraded. Nothing carries a known advisory affecting this code, and a wholesale bump does not belong in the same PR as a release-blocking fix.                                                                                                                                                    |

---

## Release recommendation

**Patch release (1.0.2), after a manual pass in Chrome.**

The user-visible behaviour of the core workflow is unchanged: the same checks,
the same permissions, the same privacy model, the same read-only guarantee. What
changed is that the popup opens properly, the findings are more nearly correct in
both directions, and the options page keeps its promises. That is patch-shaped
work.

Two things argue for care rather than speed:

- The popup was restructured, not tweaked. It is well covered by tests and was
  audited in a real browser, but it is the surface the user sees first, and
  screenshots in the store listing show the old layout.
- The Firefox permission fix is correct on paper and asserted by the manifest
  guard, but nobody has run it in Firefox.

**Before submitting:** run the manual matrix in Chrome (the popup opening
repeatedly is the one that matters), then decide whether to reshoot the store
screenshots. Store metadata does not otherwise need to change — permissions,
privacy disclosure and permission justifications are all still accurate, because
none of them changed.

No release was published, no tag was created, no store listing was touched.
