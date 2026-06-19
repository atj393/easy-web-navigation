# Privacy disclosure (store form answers)

Copy-paste answers aligned with Chrome Web Store and Microsoft Edge privacy/data forms.

## Single purpose

Easy Web Navigation helps users and developers inspect keyboard accessibility issues on web pages
using local, read-only scanning and optional visual helpers.

## Permission justifications

- **activeTab:** inspect the active tab only after the user acts.
- **scripting:** inject the read-only inspection content script into the active tab on demand.
- **storage:** persist user preferences locally.
- **optional host permissions (http/https):** requested only when the user opts into "This site" or
  "All supported websites" monitoring.

(Full detail in `permission-justifications.md`.)

## Remote code

No. The extension does not use remote code. All logic is packaged in the extension. No `eval`, no
`new Function`, no externally hosted scripts.

## Data collection / usage (Chrome "Data" tab)

The extension does **not** collect or use any of the following: personally identifiable information,
health information, financial/payment information, authentication information, personal
communications, location, web history, or user activity. It processes the active page's DOM locally
to compute accessibility findings; this is not collected or transmitted.

- Sold to third parties: **No.**
- Transferred to third parties (except for the core functionality): **No.**
- Used or transferred for purposes unrelated to the single purpose: **No.**
- Used or transferred to determine creditworthiness / for lending: **No.**

## Limited use / data handling certification

The extension's data handling complies with a limited-use posture: data is processed locally for the
single purpose only, is not sold, is not transferred, and is not used for advertising, analytics, or
profiling.

## Analytics / tracking

None. No analytics SDKs, no telemetry, no trackers.

## External processing / network

None at runtime. No remote API calls, no external servers, no AI services.

## Account / authentication

None. The extension has no login and no account.

## Privacy policy URL

Host `docs/store/privacy-policy.md` at a public URL if the store requires one (e.g. the GitHub
"raw"/Pages URL for that file), and paste that URL into the store's Privacy policy field.
