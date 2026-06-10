import { describe, it, expect } from "vitest";
import { scanDocument, getElementPreview, getStableSelector } from "./index";
import type { ScanRequest } from "@keywise/shared-types";

// A minimal stand-in for Document so these tests need no DOM environment.
const fakeDoc = {} as unknown as Document;

describe("@keywise/dom-scanner", () => {
  const request: ScanRequest = { requestId: "req-1", url: "https://example.com" };

  it("returns a valid placeholder ScanResult", () => {
    const result = scanDocument(request, fakeDoc);
    expect(result.requestId).toBe("req-1");
    expect(result.url).toBe("https://example.com");
    expect(result.placeholder).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.stats.focusableElements).toBe(0);
  });

  it("handles missing elements gracefully", () => {
    expect(getElementPreview(null)).toBe("(none)");
    expect(getStableSelector(null)).toBe("");
  });
});
