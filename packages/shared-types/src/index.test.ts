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
      requestId: "test",
      url: "https://example.com",
      timestamp: 0,
      issues: [],
      stats: { focusableElements: 0, issues: 0, durationMs: 0 },
      placeholder: true,
    };
    const message: ExtensionMessage = { type: "SCAN_RESULT", payload: result };
    expect(message.type).toBe("SCAN_RESULT");
  });
});
