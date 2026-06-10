import { describe, it, expect } from "vitest";
import {
  generateMarkdownReport,
  generateJsonReport,
  DISCLAIMER,
  PRODUCT_NAME,
  REPORT_TYPE,
} from "./index";
import type { A11yIssue, ScanResult, TabPathSummary } from "@easy-web-navigation/shared-types";

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

const tabPathSummary: TabPathSummary = { shown: 12, totalDetected: 130, capped: true };

describe("@easy-web-navigation/report-generator — Markdown", () => {
  it("includes the product name, report type, page URL/title, and disclaimer", () => {
    const md = generateMarkdownReport(result);
    expect(md).toContain(`# ${PRODUCT_NAME}`);
    expect(md).toContain(REPORT_TYPE);
    expect(md).toContain("https://example.com");
    expect(md).toContain("Example");
    expect(md).toContain(DISCLAIMER);
  });

  it("includes issue WCAG references and recommendations", () => {
    const md = generateMarkdownReport(result);
    expect(md).toContain("2.4.3 Focus Order (A)");
    expect(md).toContain("`positive-tabindex`");
    expect(md).toContain("Remove the positive tabindex.");
    expect(md).toContain("runtime DOM inspection (observable only)");
  });

  it("includes the tab-path summary only when provided, clearly labeled", () => {
    const without = generateMarkdownReport(result);
    expect(without).not.toContain("Tab path visualization summary");

    const withTab = generateMarkdownReport(result, { tabPathSummary });
    expect(withTab).toContain("Tab path visualization summary");
    expect(withTab).toContain("Runtime visual aid only — not an audit metric.");
    expect(withTab).toContain("Total detected: 130");
    expect(withTab).toContain("Capped: yes");
  });

  it("states clearly when no issues were found", () => {
    const clean: ScanResult = { ...result, issues: [], summary: { ...result.summary, total: 0 } };
    const md = generateMarkdownReport(clean);
    expect(md).toContain("No issues found");
    expect(md).toContain(DISCLAIMER);
  });
});

describe("@easy-web-navigation/report-generator — JSON", () => {
  it("is valid JSON with productName, profile, disclaimer, page, summary, issues", () => {
    const parsed = JSON.parse(generateJsonReport(result));
    expect(parsed.productName).toBe(PRODUCT_NAME);
    expect(parsed.profile).toBe(result.profile);
    expect(parsed.disclaimer).toBe(DISCLAIMER);
    expect(parsed.page.url).toBe("https://example.com");
    expect(parsed.page.title).toBe("Example");
    expect(parsed.summary.total).toBe(1);
    expect(parsed.issues[0].ruleId).toBe("positive-tabindex");
  });

  it("omits tabPathSummary unless provided", () => {
    expect(JSON.parse(generateJsonReport(result)).tabPathSummary).toBeUndefined();
    const withTab = JSON.parse(generateJsonReport(result, { tabPathSummary }));
    expect(withTab.tabPathSummary).toEqual(tabPathSummary);
  });
});
