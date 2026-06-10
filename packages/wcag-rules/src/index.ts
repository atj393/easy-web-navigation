/**
 * @easy-web-navigation/wcag-rules
 *
 * Rule METADATA plus deterministic, read-only rule evaluators for the Easy Web Navigation
 * Web "Keyboard and Navigation Profile" (WCAG 2.2 A/AA).
 *
 * The evaluators are DOM-agnostic: every DOM operation they need is provided
 * by an injected `RuleContext`. This keeps the dependency one-directional
 * (`dom-scanner` builds the context and calls these; this package never
 * imports `dom-scanner`) and avoids a circular dependency.
 *
 * Nothing here mutates the page. Detection is conservative and based only on
 * what is observable in the DOM — never on hidden JavaScript behavior.
 */
import type { A11yIssue, A11yRule } from "@easy-web-navigation/shared-types";
import { CRITERIA } from "./criteria";

export { CRITERIA, getCriterion } from "./criteria";
export type { CriterionId } from "./criteria";

export const RULES = {
  "clickable-not-focusable": {
    id: "clickable-not-focusable",
    title: "Clickable element is not keyboard focusable",
    level: "A",
    severity: "serious",
    category: "keyboard",
    criteria: [CRITERIA["2.1.1"], CRITERIA["4.1.2"]],
    status: "stable",
    description:
      "An element exposes interactive signals (an onclick handler or an interactive ARIA role) but cannot receive keyboard focus, so keyboard users cannot reach or activate it.",
    recommendation:
      'Use a native <button> or <a>, or add tabindex="0", a keyboard handler, and a correct role and accessible name.',
  },
  "missing-visible-focus": {
    id: "missing-visible-focus",
    title: "Focused element has no visible focus indicator",
    level: "AA",
    severity: "serious",
    category: "focus",
    criteria: [CRITERIA["2.4.7"]],
    status: "not-implemented",
    description: "Keyboard users must be able to see which element currently has focus.",
    recommendation: "Provide a clearly visible :focus-visible style; do not remove focus outlines.",
  },
  "missing-main-landmark": {
    id: "missing-main-landmark",
    title: "Page has no main landmark",
    level: "A",
    severity: "moderate",
    category: "navigation",
    criteria: [CRITERIA["2.4.1"], CRITERIA["4.1.2"]],
    status: "stable",
    description:
      'The page exposes no <main> element or role="main", so keyboard and screen-reader users have no landmark to jump to the primary content.',
    recommendation: 'Wrap the primary content in a single <main> element (or role="main").',
  },
  "missing-skip-link": {
    id: "missing-skip-link",
    title: "Page has no skip-to-content link",
    level: "A",
    severity: "moderate",
    category: "navigation",
    criteria: [CRITERIA["2.4.1"]],
    status: "stable",
    description:
      "The page has navigation or header content before its main content but offers no skip link, forcing keyboard users to tab through repeated blocks on every page.",
    recommendation:
      'Add a visible-on-focus "Skip to main content" link as one of the first focusable elements, targeting the main landmark.',
  },
  "positive-tabindex": {
    id: "positive-tabindex",
    title: "Element uses a positive tabindex",
    level: "A",
    severity: "moderate",
    category: "navigation",
    criteria: [CRITERIA["2.4.3"]],
    status: "stable",
    description:
      "A positive tabindex forces the element ahead of the natural DOM order, producing a focus order that is fragile and often surprising.",
    recommendation:
      'Remove the positive tabindex. Rely on DOM order, and use tabindex="0" only when an element must be focusable.',
  },
  "unlabeled-control": {
    id: "unlabeled-control",
    title: "Interactive control has no accessible name",
    level: "A",
    severity: "serious",
    category: "naming",
    criteria: [CRITERIA["2.4.6"], CRITERIA["4.1.2"]],
    status: "stable",
    description:
      "A button or link has no accessible name, so its purpose cannot be determined by keyboard or assistive-technology users.",
    recommendation:
      "Provide visible text, or an aria-label / aria-labelledby (or alt text for an icon image) describing the control's purpose.",
  },
  "unlabeled-form-input": {
    id: "unlabeled-form-input",
    title: "Form control has no associated label",
    level: "A",
    severity: "serious",
    category: "forms",
    criteria: [CRITERIA["3.3.2"], CRITERIA["4.1.2"]],
    status: "stable",
    description:
      "A form control has no programmatically associated label, so its purpose is not conveyed to keyboard or assistive-technology users.",
    recommendation:
      'Associate a <label for="…"> (or wrap the control in a <label>), or provide an aria-label. A placeholder is not a label.',
  },
} satisfies Record<string, A11yRule>;

export type RuleId = keyof typeof RULES;

/** All rule metadata as a flat list. */
export const ALL_RULES: A11yRule[] = Object.values(RULES);

/** Look up a single rule's metadata by id. */
export function getRule(id: RuleId): A11yRule {
  return RULES[id];
}

/**
 * Everything a rule needs from the DOM, injected by the scanner. Keeping this
 * here (rather than importing DOM helpers) prevents a dependency cycle.
 */
export interface RuleContext {
  document: Document;
  /** Deep (open shadow-aware) querySelectorAll from the document root. */
  query(selector: string): Element[];
  isVisible(el: Element): boolean;
  isFocusable(el: Element): boolean;
  getAccessibleName(el: Element): string;
  getStableSelector(el: Element): string;
  getElementPreview(el: Element): string;
}

interface IssueOverrides {
  description?: string;
  severity?: A11yIssue["severity"];
}

/** Build a concrete issue from a rule's metadata and a target element. */
function buildIssue(
  rule: A11yRule,
  ctx: RuleContext,
  el: Element,
  index: number,
  overrides: IssueOverrides = {},
): A11yIssue {
  return {
    id: `${rule.id}-${index}`,
    ruleId: rule.id,
    title: rule.title,
    description: overrides.description ?? rule.description,
    wcag: rule.criteria,
    level: rule.level,
    severity: overrides.severity ?? rule.severity,
    selector: ctx.getStableSelector(el),
    elementPreview: ctx.getElementPreview(el),
    recommendation: rule.recommendation,
    canAutoEnhance: false,
  };
}

const INTERACTIVE_ROLES = ["button", "link", "menuitem", "checkbox", "radio", "switch", "tab"];

/** Rule: clickable-not-focusable (WCAG 2.1.1, 4.1.2). */
export function ruleClickableNotFocusable(ctx: RuleContext): A11yIssue[] {
  const rule = RULES["clickable-not-focusable"];
  const selector = ["[onclick]", ...INTERACTIVE_ROLES.map((r) => `[role="${r}"]`)].join(", ");
  const issues: A11yIssue[] = [];
  const seen = new Set<Element>();
  for (const el of ctx.query(selector)) {
    if (seen.has(el)) continue;
    seen.add(el);
    if (!ctx.isVisible(el)) continue;
    if (ctx.isFocusable(el)) continue;
    issues.push(buildIssue(rule, ctx, el, issues.length));
  }
  return issues;
}

const NAMEABLE_FORM_CONTROL = "input, select, textarea";
const NON_NAMEABLE_INPUT_TYPES = new Set(["hidden"]);

/** Rule: unlabeled-form-input (WCAG 3.3.2, 4.1.2). */
export function ruleUnlabeledFormInput(ctx: RuleContext): A11yIssue[] {
  const rule = RULES["unlabeled-form-input"];
  const issues: A11yIssue[] = [];
  for (const el of ctx.query(NAMEABLE_FORM_CONTROL)) {
    const type = (el.getAttribute("type") ?? "").toLowerCase();
    if (NON_NAMEABLE_INPUT_TYPES.has(type)) continue;
    if (!ctx.isVisible(el)) continue;
    if (ctx.getAccessibleName(el).length > 0) continue;

    const hasPlaceholder = el.hasAttribute("placeholder");
    issues.push(
      buildIssue(rule, ctx, el, issues.length, {
        severity: hasPlaceholder ? "moderate" : "serious",
        description: hasPlaceholder
          ? `${rule.description} A placeholder is present but a placeholder is not a substitute for a label.`
          : rule.description,
      }),
    );
  }
  return issues;
}

/** Rule: positive-tabindex (WCAG 2.4.3). */
export function rulePositiveTabindex(ctx: RuleContext): A11yIssue[] {
  const rule = RULES["positive-tabindex"];
  const issues: A11yIssue[] = [];
  for (const el of ctx.query("[tabindex]")) {
    const value = Number.parseInt(el.getAttribute("tabindex") ?? "", 10);
    if (Number.isNaN(value) || value <= 0) continue;
    issues.push(buildIssue(rule, ctx, el, issues.length));
  }
  return issues;
}

/** Rule: missing-main-landmark (WCAG 2.4.1). */
export function ruleMissingMainLandmark(ctx: RuleContext): A11yIssue[] {
  const rule = RULES["missing-main-landmark"];
  const mains = ctx.query('main, [role="main"]').filter((el) => ctx.isVisible(el));
  if (mains.length > 0) return [];
  const target = ctx.document.body ?? ctx.document.documentElement;
  if (!target) return [];
  return [buildIssue(rule, ctx, target, 0)];
}

const SKIP_TARGET_ID = /^(main|content|main-?content)$/i;

/** Rule: missing-skip-link (WCAG 2.4.1). Conservative to avoid false positives. */
export function ruleMissingSkipLink(ctx: RuleContext): A11yIssue[] {
  const rule = RULES["missing-skip-link"];
  const target = ctx.document.body;
  if (!target) return [];

  // Only worth flagging when there is repeated nav/header content to bypass.
  const hasBlocksToBypass = ctx
    .query('nav, header, [role="navigation"], [role="banner"]')
    .some((el) => ctx.isVisible(el));
  if (!hasBlocksToBypass) return [];

  const mainEl = ctx.query('main, [role="main"]')[0] ?? null;
  const hasSkipLink = ctx.query('a[href^="#"]').some((a) => {
    const text = (ctx.getAccessibleName(a) || a.textContent || "").toLowerCase();
    if (text.includes("skip")) return true;
    const targetId = (a.getAttribute("href") ?? "").slice(1);
    if (!targetId) return false;
    if (SKIP_TARGET_ID.test(targetId)) return true;
    const referenced = ctx.document.getElementById(targetId);
    if (!referenced) return false;
    return referenced === mainEl || referenced.matches('main, [role="main"]');
  });
  if (hasSkipLink) return [];

  return [buildIssue(rule, ctx, target, 0)];
}

const NAMED_CONTROL = 'button, a[href], [role="button"], [role="link"]';

/** Rule: unlabeled-control (WCAG 2.4.6, 4.1.2). */
export function ruleUnlabeledControl(ctx: RuleContext): A11yIssue[] {
  const rule = RULES["unlabeled-control"];
  const issues: A11yIssue[] = [];
  const seen = new Set<Element>();
  for (const el of ctx.query(NAMED_CONTROL)) {
    if (seen.has(el)) continue;
    seen.add(el);
    if (!ctx.isVisible(el)) continue;
    if (ctx.getAccessibleName(el).length > 0) continue;
    issues.push(buildIssue(rule, ctx, el, issues.length));
  }
  return issues;
}

/** Run every implemented rule against the context, in a deterministic order. */
export function evaluateRules(ctx: RuleContext): A11yIssue[] {
  return [
    ...ruleClickableNotFocusable(ctx),
    ...ruleUnlabeledControl(ctx),
    ...ruleUnlabeledFormInput(ctx),
    ...rulePositiveTabindex(ctx),
    ...ruleMissingMainLandmark(ctx),
    ...ruleMissingSkipLink(ctx),
  ];
}
