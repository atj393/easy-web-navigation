import { defineConfig } from "vitest/config";

// Root Vitest config: discovers unit tests across all workspace packages.
//
// Popup tests live under `apps/extension/entrypoints/popup/`. They cover the
// pure state model, the user-facing copy, the popup's CSS sizing contract
// (the RB-001 regression guard), and the presentational components rendered
// into a real jsdom document — no extension APIs are touched, so no browser
// mock layer is needed.
export default defineConfig({
  esbuild: {
    // React 18 automatic runtime, matching the extension's tsconfig.
    jsx: "automatic",
  },
  test: {
    environment: "jsdom",
    include: [
      "packages/**/src/**/*.test.ts",
      "apps/**/src/**/*.test.ts",
      "apps/**/lib/**/*.test.ts",
      "apps/**/entrypoints/**/*.test.ts",
      "apps/**/entrypoints/**/*.test.tsx",
      "scripts/**/*.test.mjs",
    ],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.output/**", "**/.wxt/**"],
  },
});
