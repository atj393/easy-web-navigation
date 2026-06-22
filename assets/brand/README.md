# Brand assets

## `easy-web-navigation-icon-source.png`

This is the **official, user-provided original artwork** for Easy Web Navigation.

- It is the single canonical source for the project's brand icon.
- It is used to generate the browser-extension toolbar icons, the GitHub
  repository artwork, the Chrome Web Store assets, and the Microsoft Edge
  Add-ons assets.
- The runtime extension ships **generated PNG size variants only**
  (`apps/extension/public/icon-16.png`, `-32`, `-48`, `-128`). This original
  source image is intentionally kept **outside** `apps/extension/public/`, so it
  is **not** bundled into the store ZIP.

### How the size variants are produced

All variants are downscaled from this source by pure-Node scripts (no external
dependencies, no network):

- `apps/extension/scripts/generate-icons.mjs` → runtime toolbar icons
  (`apps/extension/public/icon-{16,32,48,128}.png`).
- `scripts/generate-store-assets.mjs` → store / GitHub assets
  (`docs/store/assets/edge-logo-300x300.png`,
  `docs/store/assets/chrome-small-promo-440x280.png`,
  `docs/assets/easy-web-navigation-icon.png`).

Both scripts read **this file** as their source. Do not replace the generated
variants with unrelated or downloaded artwork — regenerate them from this source
instead.

### Provenance

Original artwork supplied by the project owner. No stock assets, online
generators, or third-party copyrighted artwork are used.
