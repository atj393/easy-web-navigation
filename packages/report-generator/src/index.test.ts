import { describe, it, expect } from "vitest";
import { generateMarkdownReport, generateJsonReport, DISCLAIMER } from "./index";
import type { ScanResult } from "@keywise/shared-types";

const result: ScanResult = {
  requestId: "req-1",
  url: "https://example.com",
  timestamp: 0,
  issues: [],
  stats: { focusableElements: 3, issues: 0, durationMs: 0 },
  placeholder: true,
};

describe("@keywise/report-generator", () => {
  it("produces a Markdown report that includes the URL and disclaimer", () => {
    const md = generateMarkdownReport(result);
    expect(md).toContain("# KeyWise Web");
    expect(md).toContain("https://example.com");
    expect(md).toContain(DISCLAIMER);
  });

  it("produces valid JSON that round-trips and carries the disclaimer", () => {
    const json = generateJsonReport(result);
    const parsed = JSON.parse(json);
    expect(parsed.tool).toBe("KeyWise Web");
    expect(parsed.disclaimer).toBe(DISCLAIMER);
    expect(parsed.result.requestId).toBe("req-1");
  });
});
