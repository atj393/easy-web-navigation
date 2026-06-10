import { defineConfig } from "vitest/config";

// Root Vitest config: discovers unit tests across all workspace packages.
export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/**/src/**/*.test.ts", "apps/**/src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.output/**", "**/.wxt/**"],
  },
});
