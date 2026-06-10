/**
 * @keywise/report-generator
 *
 * Turns a ScanResult into a Markdown or JSON report. Every report carries the
 * non-compliance disclaimer: KeyWise Web inspects, it does not certify.
 */
import type { A11yIssue, ScanResult } from "@keywise/shared-types";

const DISCLAIMER =
  "KeyWise Web helps inspect keyboard accessibility at runtime. " +
  "It does not certify legal compliance with WCAG, BITV, EN 301 549, EAA, ADA, or Section 508. " +
  "It is not a substitute for manual testing or expert review.";

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

/** Render a ScanResult as a Markdown document string. */
export function generateMarkdownReport(result: ScanResult): string {
  const lines: string[] = [];
  lines.push("# KeyWise Web — Keyboard Accessibility Report");
  lines.push("");
  lines.push(`- Page: ${result.title || "(untitled)"}`);
  lines.push(`- URL: ${result.url || "(unknown)"}`);
  lines.push(`- Profile: ${result.profile}`);
  lines.push(`- Scanned: ${formatDate(result.scannedAt)}`);
  lines.push(`- Focusable elements: ${result.focusableCount}`);
  lines.push("");

  lines.push("## Summary");
  lines.push("");
  lines.push(`- Total issues: ${result.summary.total}`);
  for (const [severity, count] of Object.entries(result.summary.bySeverity)) {
    if (count > 0) lines.push(`  - ${severity}: ${count}`);
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
      lines.push(`### ${index + 1}. ${issue.title} [${issue.severity}]`);
      lines.push("");
      lines.push(`- Rule: \`${issue.ruleId}\``);
      lines.push(`- WCAG: ${wcagRefs(issue)}`);
      lines.push(`- Selector: \`${issue.selector}\``);
      lines.push(`- Element: \`${issue.elementPreview}\``);
      lines.push(`- Why: ${issue.description}`);
      lines.push(`- Recommendation: ${issue.recommendation}`);
      lines.push("");
    });
  }

  lines.push("---");
  lines.push("");
  lines.push(`_${DISCLAIMER}_`);
  lines.push("");

  return lines.join("\n");
}

/** Render a ScanResult as a pretty-printed JSON report string. */
export function generateJsonReport(result: ScanResult): string {
  return JSON.stringify(
    {
      tool: "KeyWise Web",
      schemaVersion: "0.2",
      disclaimer: DISCLAIMER,
      result,
    },
    null,
    2,
  );
}

export { DISCLAIMER };
