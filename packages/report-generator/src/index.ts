/**
 * @keywise/report-generator
 *
 * Phase 0A: turns a ScanResult into a Markdown or JSON report. Because scans
 * are placeholders for now, reports clearly state that no real analysis was
 * performed and include the non-compliance disclaimer.
 */
import type { ScanResult } from "@keywise/shared-types";

const DISCLAIMER =
  "KeyWise Web helps inspect keyboard accessibility at runtime. " +
  "It does not certify legal compliance with WCAG, BITV, EN 301 549, EAA, ADA, or Section 508.";

/** Render a ScanResult as a Markdown document string. */
export function generateMarkdownReport(result: ScanResult): string {
  const lines: string[] = [];
  lines.push("# KeyWise Web — Keyboard Accessibility Report");
  lines.push("");
  lines.push(`- URL: ${result.url}`);
  lines.push(`- Request ID: ${result.requestId}`);
  lines.push(`- Generated: ${result.timestamp}`);
  lines.push(`- Focusable elements: ${result.stats.focusableElements}`);
  lines.push(`- Issues found: ${result.stats.issues}`);
  lines.push("");

  if (result.placeholder) {
    lines.push("> Note: this is a Phase 0A placeholder scan. No analysis was performed yet.");
    lines.push("");
  }

  lines.push("## Issues");
  lines.push("");
  if (result.issues.length === 0) {
    lines.push("_No issues recorded._");
  } else {
    for (const issue of result.issues) {
      const criteria = issue.criteria.map((c) => c.id).join(", ");
      lines.push(`- **[${issue.severity}]** ${issue.message} (WCAG ${criteria})`);
    }
  }
  lines.push("");
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
      schemaVersion: "0.1",
      disclaimer: DISCLAIMER,
      result,
    },
    null,
    2,
  );
}

export { DISCLAIMER };
