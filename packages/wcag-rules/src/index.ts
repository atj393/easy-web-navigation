/**
 * @keywise/wcag-rules
 *
 * Phase 0A: placeholder rule METADATA only. None of these rules implement
 * detection logic yet — every entry is marked `status: "not-implemented"`.
 * The catalog exists so the UI, report generator, and scanner can be wired
 * against a stable shape before any analysis is written.
 */
import type { A11yRule } from "@keywise/shared-types";
import { CRITERIA } from "./criteria";

export { CRITERIA, getCriterion } from "./criteria";
export type { CriterionId } from "./criteria";

export const RULES = {
  "clickable-not-focusable": {
    id: "clickable-not-focusable",
    title: "Clickable element is not keyboard focusable",
    level: "A",
    severity: "serious",
    criteria: [CRITERIA["2.1.1"], CRITERIA["4.1.2"]],
    status: "not-implemented",
    description:
      "Elements that respond to click should be reachable and operable with the keyboard.",
  },
  "missing-visible-focus": {
    id: "missing-visible-focus",
    title: "Focused element has no visible focus indicator",
    level: "AA",
    severity: "serious",
    criteria: [CRITERIA["2.4.7"]],
    status: "not-implemented",
    description: "Keyboard users must be able to see which element currently has focus.",
  },
  "missing-main-landmark": {
    id: "missing-main-landmark",
    title: "Page has no main landmark",
    level: "A",
    severity: "moderate",
    criteria: [CRITERIA["2.4.1"], CRITERIA["4.1.2"]],
    status: "not-implemented",
    description: "A main landmark helps users skip directly to the primary content.",
  },
  "missing-skip-link": {
    id: "missing-skip-link",
    title: "Page has no skip-to-content link",
    level: "A",
    severity: "moderate",
    criteria: [CRITERIA["2.4.1"]],
    status: "not-implemented",
    description: "A skip link lets keyboard users bypass repeated navigation blocks.",
  },
  "positive-tabindex": {
    id: "positive-tabindex",
    title: "Element uses a positive tabindex",
    level: "A",
    severity: "moderate",
    criteria: [CRITERIA["2.4.3"]],
    status: "not-implemented",
    description: "Positive tabindex values distort the natural focus order and are fragile.",
  },
  "unlabeled-control": {
    id: "unlabeled-control",
    title: "Interactive control has no accessible name",
    level: "A",
    severity: "serious",
    criteria: [CRITERIA["4.1.2"], CRITERIA["2.4.6"]],
    status: "not-implemented",
    description: "Buttons, links, and widgets need a programmatically determinable name.",
  },
  "unlabeled-form-input": {
    id: "unlabeled-form-input",
    title: "Form input has no associated label",
    level: "A",
    severity: "serious",
    criteria: [CRITERIA["3.3.2"], CRITERIA["4.1.2"]],
    status: "not-implemented",
    description: "Form fields require labels or instructions so their purpose is clear.",
  },
} satisfies Record<string, A11yRule>;

export type RuleId = keyof typeof RULES;

/** All rule metadata as a flat list. */
export const ALL_RULES: A11yRule[] = Object.values(RULES);

/** Look up a single rule's metadata by id. */
export function getRule(id: RuleId): A11yRule {
  return RULES[id];
}
