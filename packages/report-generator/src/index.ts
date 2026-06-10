/**
 * @easy-web-navigation/report-generator
 *
 * Turns a ScanResult into a clean, developer-friendly Markdown or JSON report.
 * Every report carries the prominent non-compliance disclaimer: Easy Web
 * Navigation inspects at runtime — it does not certify.
 */
import type {
  A11yIssue,
  ReportOptions,
  ScanResult,
  ScanSummary,
  TabPathSummary,
} from "@easy-web-navigation/shared-types";

export const PRODUCT_NAME = "Easy Web Navigation";
export const REPORT_TYPE = "WCAG 2.2 Keyboard and Navigation Profile";
export const SCHEMA_VERSION = "0.3";

/** Prominent, non-compliance disclaimer included in every report. */
export const DISCLAIMER =
  "This report is a developer aid generated from runtime DOM inspection. " +
  "It does not certify legal compliance with WCAG, BITV, EN 301 549, EAA, ADA, or Section 508. " +
  "A clean report is not a compliance pass. Full accessibility requires source-level remediation, " +
  "manual testing, and user testing with assistive technologies.";

function formatDate(epochMs: number): string {
  if (!epochMs) return "(not recorded)";
  try {
    return new Date(epochMs).toISOString();
  } catch {
    return String(epochMs);
  }
}

function wcagRefs(issue: A11yIssue): string {
  return issue.wcag.map((c) => `${c.id} ${c.name} (${c.level})`).join("; ");
}

function nonZeroCounts(counts: Record<string, number>): [string, number][] {
  return Object.entries(counts).filter(([, n]) => n > 0);
}

function summaryLines(summary: ScanSummary): string[] {
  const lines: string[] = [];
  lines.push(`- Total issues: ${summary.total}`);

  const bySeverity = nonZeroCounts(summary.bySeverity);
  if (bySeverity.length > 0) {
    lines.push("");
    lines.push("By severity:");
    for (const [severity, count] of bySeverity) lines.push(`- ${severity}: ${count}`);
  }

  const byCategory = nonZeroCounts(summary.byCategory);
  if (byCategory.length > 0) {
    lines.push("");
    lines.push("By category:");
    for (const [category, count] of byCategory) lines.push(`- ${category}: ${count}`);
  }

  return lines;
}

function tabPathLines(tabPathSummary: TabPathSummary): string[] {
  return [
    "### Tab path visualization summary",
    "",
    "_Runtime visual aid only — not an audit metric._",
    "",
    `- Shown: ${tabPathSummary.shown}`,
    `- Total detected: ${tabPathSummary.totalDetected}`,
    `- Capped: ${tabPathSummary.capped ? "yes" : "no"}`,
  ];
}

/** Render a ScanResult as a Markdown document string. */
export function generateMarkdownReport(result: ScanResult, options: ReportOptions = {}): string {
  const lines: string[] = [];

  lines.push(`# ${PRODUCT_NAME} — Keyboard Accessibility Report`);
  lines.push("");
  lines.push(`**Report type:** ${REPORT_TYPE}`);
  lines.push("");

  lines.push("## Page");
  lines.push("");
  lines.push(`- Title: ${result.title || "(untitled)"}`);
  lines.push(`- URL: ${result.url || "(unknown)"}`);
  lines.push(`- Scanned: ${formatDate(result.scannedAt)}`);
  lines.push(`- Focusable elements: ${result.focusableCount}`);
  lines.push("");

  lines.push("## Summary");
  lines.push("");
  lines.push(...summaryLines(result.summary));
  if (options.tabPathSummary) {
    lines.push("");
    lines.push(...tabPathLines(options.tabPathSummary));
  }
  lines.push("");

  lines.push("## Issues");
  lines.push("");
  if (result.issues.length === 0) {
    lines.push(
      "_No issues found by the implemented rules. This is not a guarantee of accessibility._",
    );
  } else {
    result.issues.forEach((issue, index) => {
      lines.push(`### ${index + 1}. ${issue.title} — ${issue.severity}`);
      lines.push("");
      lines.push(`- WCAG: ${wcagRefs(issue)}`);
      lines.push(`- Rule: \`${issue.ruleId}\``);
      lines.push(`- Selector: \`${issue.selector}\``);
      lines.push(`- Element: \`${issue.elementPreview}\``);
      lines.push(`- Detection: runtime DOM inspection (observable only)`);
      lines.push(`- Why: ${issue.description}`);
      lines.push(`- Recommendation: ${issue.recommendation}`);
      lines.push("");
    });
  }

  lines.push("## Disclaimer");
  lines.push("");
  lines.push(DISCLAIMER);
  lines.push("");

  return lines.join("\n");
}

/** Render a ScanResult as a pretty-printed, stable JSON report string. */
export function generateJsonReport(result: ScanResult, options: ReportOptions = {}): string {
  const report: Record<string, unknown> = {
    productName: PRODUCT_NAME,
    profile: result.profile,
    reportType: REPORT_TYPE,
    schemaVersion: SCHEMA_VERSION,
    disclaimer: DISCLAIMER,
    generatedAt: result.scannedAt ? formatDate(result.scannedAt) : null,
    page: { title: result.title, url: result.url, focusableCount: result.focusableCount },
    summary: result.summary,
    issues: result.issues,
  };
  // Only present when supplied — clearly a runtime visual aid, not an audit metric.
  if (options.tabPathSummary) report.tabPathSummary = options.tabPathSummary;
  return JSON.stringify(report, null, 2);
}
