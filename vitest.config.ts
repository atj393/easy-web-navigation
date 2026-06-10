import { defineConfig } from "vitest/config";

// Root Vitest config: discovers unit tests across all workspace packages.
export default defineConfig({
  test: {
    environment: "jsdom",
    include: [
      "packages/**/src/**/*.test.ts",
      "apps/**/src/**/*.test.ts",
      "apps/**/lib/**/*.test.ts",
    ],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.output/**", "**/.wxt/**"],
  },
});
