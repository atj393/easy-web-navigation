import { defineConfig } from "wxt";

// Easy Web Navigation — WXT configuration (Manifest V3).
// Phase 0A permissions are intentionally minimal: no broad host permissions.
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  // Clean, predictable store ZIP names: easy-web-navigation-<version>-<browser>.zip
  zip: {
    name: "easy-web-navigation",
  },
  hooks: {
    // The runtime-registered content script would otherwise cause WXT to add
    // `host_permissions: ["<all_urls>"]`. Phase 0A deliberately ships NO broad
    // host permissions: the content script is injected into the active tab on
    // demand via activeTab + scripting, so we strip host_permissions here.
    "build:manifestGenerated"(_wxt, manifest) {
      delete manifest.host_permissions;
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
    optional_host_permissions: ["http://*/*", "https://*/*"],
  },
});
