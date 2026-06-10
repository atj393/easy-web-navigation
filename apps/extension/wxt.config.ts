import { defineConfig } from "wxt";

// KeyWise Web — WXT configuration (Manifest V3).
// Phase 0A permissions are intentionally minimal: no broad host permissions.
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
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
    name: "KeyWise Web",
    description:
      "A WCAG 2.2 keyboard accessibility companion for inspecting focus, tab order, and navigation issues.",
    // Phase 0A required permissions only.
    permissions: ["activeTab", "scripting", "storage"],
    // No host_permissions in Phase 0A. The content script is registered at
    // runtime and injected into the active tab via activeTab + scripting,
    // so no broad <all_urls> host access is requested up front.
    //
    // Future (documented, NOT relied upon in v0):
    //   optional_host_permissions: ["<all_urls>"]
  },
});
