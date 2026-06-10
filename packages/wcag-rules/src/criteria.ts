import type { WcagCriterion } from "@easy-web-navigation/shared-types";

/**
 * The WCAG 2.2 criteria that make up the Easy Web Navigation "Keyboard and
 * Navigation Profile". This is reference metadata only.
 */
export const CRITERIA = {
  "2.1.1": {
    id: "2.1.1",
    name: "Keyboard",
    level: "A",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html",
  },
  "2.1.2": {
    id: "2.1.2",
    name: "No Keyboard Trap",
    level: "A",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/no-keyboard-trap.html",
  },
  "2.4.1": {
    id: "2.4.1",
    name: "Bypass Blocks",
    level: "A",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html",
  },
  "2.4.3": {
    id: "2.4.3",
    name: "Focus Order",
    level: "A",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html",
  },
  "2.4.6": {
    id: "2.4.6",
    name: "Headings and Labels",
    level: "AA",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels.html",
  },
  "2.4.7": {
    id: "2.4.7",
    name: "Focus Visible",
    level: "AA",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html",
  },
  "2.4.11": {
    id: "2.4.11",
    name: "Focus Not Obscured (Minimum)",
    level: "AA",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html",
  },
  "3.3.2": {
    id: "3.3.2",
    name: "Labels or Instructions",
    level: "A",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html",
  },
  "4.1.2": {
    id: "4.1.2",
    name: "Name, Role, Value",
    level: "A",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html",
  },
} satisfies Record<string, WcagCriterion>;

export type CriterionId = keyof typeof CRITERIA;

/** Look up a criterion by its dotted id. */
export function getCriterion(id: CriterionId): WcagCriterion {
  return CRITERIA[id];
}
