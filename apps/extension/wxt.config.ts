import { defineConfig } from "wxt";

/**
 * Easy Web Navigation — WXT configuration.
 *
 * Permissions are deliberately minimal and must stay that way:
 *   required:        activeTab, scripting, storage
 *   required hosts:  none
 *   optional hosts:  http://*&#47;*, https://*&#47;*  (requested at runtime, on a
 *                    user action, only for site / all-sites automatic checking)
 *
 * `scripts/check-manifest.mjs` validates the BUILT manifests against exactly
 * that, for both browsers, so a dependency upgrade cannot quietly widen them.
 */

/** Optional host access, requested at runtime and never at install time. */
const OPTIONAL_HOSTS = ["http://*/*", "https://*/*"];

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  // Clean, predictable store ZIP names: easy-web-navigation-<version>-<browser>.zip
  zip: {
    name: "easy-web-navigation",
  },
  hooks: {
    "build:manifestGenerated"(_wxt, manifest) {
      // The runtime-registered content script would otherwise make WXT add
      // `host_permissions: ["<all_urls>"]`. The extension deliberately ships NO
      // broad host permissions: the content script is injected into the active
      // tab on demand via activeTab + scripting.
      delete manifest.host_permissions;

      // Manifest V2 (Firefox) has no `optional_host_permissions` key, so WXT
      // drops it — which left the "This website" and "All websites" automatic-
      // checking scopes permanently unavailable there, because the browser
      // rejects a request for origins the manifest never declared. MV2 spells
      // the same thing `optional_permissions`. This is the SAME optional
      // access already declared for Chromium, expressed in the MV2 key; no
      // required permission changes, and nothing is granted until the user
      // accepts the browser's prompt.
      if (manifest.manifest_version === 2) {
        const existing = Array.isArray(manifest.optional_permissions)
          ? manifest.optional_permissions
          : [];
        manifest.optional_permissions = [...new Set([...existing, ...OPTIONAL_HOSTS])];
        delete manifest.optional_host_permissions;
      }
    },
  },
  manifest: {
    // Full descriptive store/manifest name. The compact toolbar/popup brand
    // ("Easy Web Navigation") is provided by `short_name` and the in-product UI.
    name: "Easy Web Navigation - Keyboard Access Check",
    short_name: "Easy Web Nav",
    description:
      "A keyboard accessibility companion for inspecting focus, keyboard path, and navigation issues on web pages.",
    // Runtime PNG icons live in public/ — downscaled from the official brand
    // source (assets/brand/easy-web-navigation-icon-source.png) by
    // scripts/generate-icons.mjs. The source image is not bundled.
    icons: {
      16: "icon-16.png",
      32: "icon-32.png",
      48: "icon-48.png",
      128: "icon-128.png",
    },
    action: {
      default_title: "Easy Web Navigation - Keyboard Access Check",
      default_icon: {
        16: "icon-16.png",
        32: "icon-32.png",
        48: "icon-48.png",
        128: "icon-128.png",
      },
    },
    // Required permissions only — intentionally minimal.
    permissions: ["activeTab", "scripting", "storage"],
    // No REQUIRED host_permissions. Optional host permissions are requested at
    // runtime, only after the user starts monitoring with a site / all-sites
    // scope (see Phase 0G). Manual scanning uses activeTab and needs none of
    // these. The `build:manifestGenerated` hook above strips any required
    // host_permissions WXT would add for the runtime content script.
    optional_host_permissions: OPTIONAL_HOSTS,
  },
});
