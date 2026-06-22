# GitHub repository "About" settings

Canonical record of the GitHub **About** metadata for
[`atj393/easy-web-navigation`](https://github.com/atj393/easy-web-navigation). These values were
applied with the GitHub CLI; this file is the source of truth if they ever need to be re-applied
manually.

## Product name vs. About description

The GitHub **About** description is intentionally short and benefit-first. It is **not** the store
name. For reference:

- **Store / manifest name:** `Easy Web Navigation - Keyboard Access Check`
- **Compact toolbar/popup brand:** `Easy Web Navigation`
- **GitHub About description:** the concise sentence below (keep as-is)

Do not put the full hyphenated store name in the About description, and do not add
"Make Every Site Accessible", "certified", "compliant", or "automatic fixer".

## Description (exact)

```
A privacy-first browser extension for checking keyboard navigation, focus, and visible keyboard paths.
```

## Topics

The repository must carry at least these topics (GitHub allows up to 20):

```
accessibility
web-accessibility
keyboard-navigation
a11y
browser-extension
chrome-extension
microsoft-edge
wcag
```

Do **not** add these topics (they would misrepresent the product):

```
compliance
certified
ai
overlay
auto-fix
```

## Homepage / website

Leave the homepage **unset** to a marketing/store URL. Do not add a Chrome Web Store or Microsoft
Edge Add-ons link until those listings are actually live.

## How to apply (GitHub CLI)

```bash
gh repo edit atj393/easy-web-navigation \
  --description "A privacy-first browser extension for checking keyboard navigation, focus, and visible keyboard paths." \
  --add-topic accessibility \
  --add-topic web-accessibility \
  --add-topic keyboard-navigation \
  --add-topic a11y \
  --add-topic browser-extension \
  --add-topic chrome-extension \
  --add-topic microsoft-edge \
  --add-topic wcag
```

## How to apply (web UI)

1. Open https://github.com/atj393/easy-web-navigation.
2. Click the **⚙ (gear)** next to **About** (top-right of the repository page).
3. Paste the description above.
4. Add the topics above.
5. Leave **Website** empty (no store/marketing URL yet).
6. Save changes.
