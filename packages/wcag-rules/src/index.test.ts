import { describe, it, expect } from "vitest";
import { ALL_RULES, RULES, getRule } from "./index";

describe("@keywise/wcag-rules metadata", () => {
  it("defines the seven keyboard-profile rules", () => {
    expect(ALL_RULES).toHaveLength(7);
  });

  it("marks the six Phase 0B rules as implemented and keeps focus-visible deferred", () => {
    const implemented = ALL_RULES.filter((r) => r.status !== "not-implemented");
    expect(implemented).toHaveLength(6);
    expect(RULES["missing-visible-focus"].status).toBe("not-implemented");
  });

  it("gives every rule criteria, a category, and a recommendation", () => {
    for (const rule of ALL_RULES) {
      expect(rule.criteria.length).toBeGreaterThan(0);
      expect(rule.category).toBeTruthy();
      expect(rule.recommendation.length).toBeGreaterThan(0);
    }
  });

  it("looks up a rule by id", () => {
    expect(getRule("positive-tabindex").id).toBe("positive-tabindex");
    expect(RULES["unlabeled-form-input"].level).toBe("A");
  });
});
