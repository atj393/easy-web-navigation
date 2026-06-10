import { describe, it, expect, expectTypeOf } from "vitest";
import {
  DEFAULT_SETTINGS,
  type ExtensionMessage,
  type ExtensionSettings,
  type ScanResult,
} from "./index";

describe("@keywise/shared-types", () => {
  it("exposes sane default settings", () => {
    expect(DEFAULT_SETTINGS.enableVisibleFocusHelper).toBe(true);
    expect(Array.isArray(DEFAULT_SETTINGS.disabledDomains)).toBe(true);
    expect(DEFAULT_SETTINGS.disabledDomains).toHaveLength(0);
  });

  it("DEFAULT_SETTINGS conforms to the ExtensionSettings contract", () => {
    expectTypeOf(DEFAULT_SETTINGS).toMatchTypeOf<ExtensionSettings>();
  });

  it("models scan messages as a discriminated union", () => {
    const result: ScanResult = {
      url: "https://example.com",
      title: "Example",
      scannedAt: 0,
      profile: "WCAG 2.2 Keyboard & Navigation Profile (Level A/AA)",
      issues: [],
      summary: {
        total: 0,
        bySeverity: { critical: 0, serious: 0, moderate: 0, minor: 0, info: 0 },
        byCategory: { keyboard: 0, focus: 0, navigation: 0, forms: 0, naming: 0 },
        byRule: {},
      },
      focusableCount: 0,
    };
    const message: ExtensionMessage = { type: "SCAN_RESULT", payload: result };
    expect(message.type).toBe("SCAN_RESULT");

    const error: ExtensionMessage = { type: "SCAN_ERROR", payload: { message: "nope" } };
    expect(error.type).toBe("SCAN_ERROR");
  });
});
