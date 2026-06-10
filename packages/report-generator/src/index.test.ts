import { describe, it, expect } from "vitest";
import { generateMarkdownReport, generateJsonReport, DISCLAIMER } from "./index";
import type { A11yIssue, ScanResult } from "@keywise/shared-types";

const issue: A11yIssue = {
  id: "positive-tabindex-0",
  ruleId: "positive-tabindex",
  title: "Element uses a positive tabindex",
  description: "A positive tabindex distorts the natural focus order.",
  wcag: [{ id: "2.4.3", name: "Focus Order", level: "A" }],
  level: "A",
  severity: "moderate",
  selector: "#cta",
  elementPreview: '<a id="cta" tabindex="3">Buy</a>',
  recommendation: "Remove the positive tabindex.",
  canAutoEnhance: false,
};

const result: ScanResult = {
  url: "https://example.com",
  title: "Example",
  scannedAt: 0,
  profile: "WCAG 2.2 Keyboard & Navigation Profile (Level A/AA)",
  issues: [issue],
  summary: {
    total: 1,
    bySeverity: { critical: 0, serious: 0, moderate: 1, minor: 0, info: 0 },
    byCategory: { keyboard: 0, focus: 0, navigation: 1, forms: 0, naming: 0 },
    byRule: { "positive-tabindex": 1 },
  },
  focusableCount: 5,
};

describe("@keywise/report-generator", () => {
  it("renders a Markdown report with URL, title, profile, issue data, and disclaimer", () => {
    const md = generateMarkdownReport(result);
    expect(md).toContain("# KeyWise Web");
    expect(md).toContain("https://example.com");
    expect(md).toContain("Example");
    expect(md).toContain("WCAG 2.2 Keyboard & Navigation Profile");
    expect(md).toContain("positive-tabindex");
    expect(md).toContain("2.4.3 Focus Order (A)");
    expect(md).toContain("Remove the positive tabindex.");
    expect(md).toContain(DISCLAIMER);
  });

  it("renders valid JSON carrying the real result and disclaimer", () => {
    const json = generateJsonReport(result);
    const parsed = JSON.parse(json);
    expect(parsed.tool).toBe("KeyWise Web");
    expect(parsed.disclaimer).toBe(DISCLAIMER);
    expect(parsed.result.issues[0].ruleId).toBe("positive-tabindex");
    expect(parsed.result.summary.total).toBe(1);
  });

  it("states clearly when no issues were found", () => {
    const clean: ScanResult = { ...result, issues: [], summary: { ...result.summary, total: 0 } };
    const md = generateMarkdownReport(clean);
    expect(md).toContain("No issues found");
    expect(md).toContain(DISCLAIMER);
  });
});
